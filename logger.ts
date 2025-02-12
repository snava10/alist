const getFileAndLine = () => {
  const err = new Error();
  const stackLines = err.stack?.split("\n") || [];

  if (stackLines.length >= 3) {
    // Extract file path and line number
    const match = stackLines[2].match(/\((.*):(\d+):(\d+)\)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
  }

  return "unknown";
};

// Log function
const log = (level: string, message: any) => {
  const fileInfo = getFileAndLine();
  console.log(`[${level.toUpperCase()}] (${fileInfo}) →`, message);
};

// Export logging functions
const logger = {
  debug: (msg: any) => log("debug", msg),
  info: (msg: any) => log("info", msg),
  warn: (msg: any) => log("warn", msg),
  error: (msg: any) => log("error", msg),
};

export default logger;
