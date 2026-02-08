
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppStatus, SecurityEvent, ExecutionResult } from './types';
import { initPyodide, runPythonCode, setInputListener, sendInputValue } from './services/pythonRunner';
import SecurityOverlay from './components/SecurityOverlay';

const DEFAULT_CODE = `# COMPILADOR PRISMA v5.0
# Profesor Daniel Riaño

print("Iniciando programa de prueba...")

nombre = input("¿Cuál es tu nombre?")
print(f"Hola {nombre}, bienvenido al compilador.")

edad_str = input("¿Cuántos años tienes?")
try:
    edad = int(edad_str)
    print(f"Tienes {edad} años. ¡Excelente!")
except:
    print("No ingresaste un número válido para la edad.")

print("Programa finalizado.")
`;

const App: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [status, setStatus] = useState<AppStatus>(AppStatus.LOADING);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [inputPrompt, setInputPrompt] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await initPyodide();
        setInputListener((prompt) => {
          setInputPrompt(prompt);
          setIsInputVisible(true);
          setStatus(AppStatus.AWAITING_INPUT);
        });
        setStatus(AppStatus.READY);
      } catch (err) {
        setStatus(AppStatus.ERROR);
      }
    };
    setup();
  }, []);

  useEffect(() => {
    if (isInputVisible) {
      setTimeout(() => inputFieldRef.current?.focus(), 100);
    }
  }, [isInputVisible]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [result, terminalHistory, isInputVisible]);

  const handleRun = async () => {
    if (status !== AppStatus.READY && status !== AppStatus.AWAITING_INPUT) return;
    
    setStatus(AppStatus.RUNNING);
    setResult(null);
    setTerminalHistory([]);
    setIsInputVisible(false);

    try {
      const res = await runPythonCode(code);
      setResult(res);
    } catch (err: any) {
      setResult({ stdout: "", stderr: "", error: err.message });
    } finally {
      setStatus(AppStatus.READY);
    }
  };

  const submitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInputVisible) return;

    const value = currentInput;
    setTerminalHistory(prev => [...prev, `${inputPrompt} ${value}`]);
    setCurrentInput("");
    setIsInputVisible(false);
    setStatus(AppStatus.RUNNING);
    
    sendInputValue(value);
  };

  const preventSecurityAction = (e: React.SyntheticEvent, type: 'paste' | 'copy') => {
    e.preventDefault();
    const message = type === 'paste' 
      ? 'Seguridad Prisma: No se permite pegar código externo.' 
      : 'Seguridad Prisma: No se permite copiar el código.';
    
    const event: SecurityEvent = { 
      type, 
      timestamp: Date.now(), 
      message 
    };
    setSecurityEvents(prev => [event, ...prev].slice(0, 3));
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-gray-100 overflow-hidden font-sans select-none">
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black italic shadow-lg shadow-indigo-600/20">P</div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter italic">Prisma Compiler</h1>
            <p className="text-[8px] text-indigo-500 font-bold tracking-[0.3em] uppercase opacity-70">Prof. Daniel Riaño</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === AppStatus.READY || status === AppStatus.AWAITING_INPUT ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              {status === AppStatus.LOADING ? 'Cargando Motor...' : status === AppStatus.AWAITING_INPUT ? 'Esperando Datos' : 'Motor Listo'}
            </span>
          </div>
          <button 
            onClick={handleRun}
            disabled={status !== AppStatus.READY}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-600 rounded text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            {status === AppStatus.RUNNING ? 'Ejecutando...' : 'Ejecutar'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-[#080808]">
          <div className="h-8 flex items-center px-6 border-b border-white/5 bg-[#0c0c0c]">
            <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Editor Protegido</span>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPaste={(e) => preventSecurityAction(e, 'paste')}
              onCopy={(e) => preventSecurityAction(e, 'copy')}
              onCut={(e) => preventSecurityAction(e, 'copy')}
              spellCheck={false}
              className="absolute inset-0 w-full h-full bg-transparent p-8 font-mono-code text-[14px] leading-relaxed outline-none resize-none text-indigo-100/90 selection:bg-indigo-500/30"
            />
          </div>
        </div>

        <div className="w-[400px] flex flex-col bg-black border-l border-white/5 relative">
          <div className="h-8 flex items-center px-6 border-b border-white/5 bg-[#0c0c0c]">
            <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Consola</span>
          </div>
          
          <div className="flex-1 p-6 font-mono-code text-[13px] overflow-y-auto custom-scrollbar space-y-3">
            {terminalHistory.map((line, i) => (
              <div key={i} className="text-gray-500 italic border-l border-white/10 pl-3">{line}</div>
            ))}
            
            {result && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {result.stdout && <pre className="text-white whitespace-pre-wrap">{result.stdout}</pre>}
                {result.error && <pre className="text-red-400 bg-red-500/5 p-4 rounded border border-red-500/20 mt-2">{result.error}</pre>}
              </div>
            )}

            {isInputVisible && (
              <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded animate-in zoom-in-95">
                <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                  {inputPrompt || "Ingrese dato:"}
                </p>
                <form onSubmit={submitInput} className="flex gap-2">
                  <input
                    ref={inputFieldRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    className="flex-1 bg-black border border-white/10 rounded px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
                    placeholder="..."
                  />
                  <button type="submit" className="bg-indigo-600 px-3 rounded text-[9px] font-bold uppercase">OK</button>
                </form>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </main>

      <SecurityOverlay events={securityEvents} onClear={() => setSecurityEvents([])} />
    </div>
  );
};

export default App;
