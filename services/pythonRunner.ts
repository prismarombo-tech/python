
import { ExecutionResult } from '../types';

let pyodideInstance: any = null;
let onInputRequested: ((prompt: string) => void) | null = null;

export const setInputListener = (callback: (prompt: string) => void) => {
  onInputRequested = callback;
};

export const initPyodide = async (): Promise<void> => {
  if (pyodideInstance) return;

  if (typeof window.loadPyodide === 'undefined') {
    throw new Error('Pyodide no detectado. Revisa la conexión a internet.');
  }

  pyodideInstance = await window.loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
  });

  // Configuración del entorno y el transformador de AST
  await pyodideInstance.runPythonAsync(`
import builtins
import asyncio
import js
import ast

# Variable para gestionar la espera
__current_input_future = None

async def custom_input(prompt_msg=""):
    global __current_input_future
    loop = asyncio.get_event_loop()
    __current_input_future = loop.create_future()
    js.notify_input_request(str(prompt_msg))
    result = await __current_input_future
    return result

def resolve_input_from_js(value):
    global __current_input_future
    if __current_input_future and not __current_input_future.done():
        __current_input_future.set_result(value)

# Transformador de AST para añadir 'await' a cada 'input()'
class InputAwaitTransformer(ast.NodeTransformer):
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            # Convertimos input(...) en await input(...)
            return ast.Await(value=node)
        return node

def transform_code(code):
    try:
        # 1. Parseamos el código a un árbol AST
        tree = ast.parse(code)
        # 2. Transformamos las llamadas a input()
        transformed_tree = InputAwaitTransformer().visit(tree)
        ast.fix_missing_locations(transformed_tree)
        # 3. Importante: Convertimos el árbol de nuevo a STRING
        # Esto corrige el error 'got Module'
        return ast.unparse(transformed_tree)
    except Exception as e:
        return f"Error de sintaxis: {str(e)}"

builtins.input = custom_input
builtins.__PRISMA_TRANSFORMER__ = transform_code
  `);

  (window as any).notify_input_request = (msg: string) => {
    if (onInputRequested) onInputRequested(msg);
  };
};

export const runPythonCode = async (code: string): Promise<ExecutionResult> => {
  if (!pyodideInstance) await initPyodide();

  let stdoutBuffer = "";
  let stderrBuffer = "";

  pyodideInstance.setStdout({
    batched: (text: string) => { stdoutBuffer += text + "\n"; }
  });

  pyodideInstance.setStderr({
    batched: (text: string) => { stderrBuffer += text + "\n"; }
  });

  try {
    // 1. Transformamos el código del usuario a una versión asíncrona (string)
    const transformer = pyodideInstance.globals.get("__PRISMA_TRANSFORMER__");
    const transformedCode = transformer(code);
    
    // Si el transformador devolvió un mensaje de error en lugar de código
    if (transformedCode.startsWith("Error de sintaxis:")) {
        throw new Error(transformedCode);
    }

    // 2. Ejecutamos el código transformado
    await pyodideInstance.runPythonAsync(transformedCode);
    
    return { 
      stdout: stdoutBuffer.trim(), 
      stderr: stderrBuffer.trim() 
    };
  } catch (err: any) {
    return { 
      stdout: stdoutBuffer.trim(), 
      stderr: stderrBuffer.trim(), 
      error: err.message 
    };
  }
};

export const sendInputValue = (value: string) => {
  if (pyodideInstance) {
    pyodideInstance.globals.get("resolve_input_from_js")(value);
  }
};
