import type { PrecompileLog } from "../components/PrecompileMonitor";

const logs: PrecompileLog[] = [];
const listeners: ((l: PrecompileLog[]) => void)[] = [];

export function pushPrecompileLog(log: Omit<PrecompileLog, "id" | "timestamp">) {
  const entry: PrecompileLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  logs.push(entry);
  if (logs.length > 50) logs.shift();
  listeners.forEach((fn) => fn([...logs]));
}

export function subscribePrecompileLogs(cb: (l: PrecompileLog[]) => void) {
  listeners.push(cb);
  cb([...logs]);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
