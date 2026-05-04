export const SUDO_WINDOW_MS = 5 * 60 * 1000;
let lastSudoTimestamp = 0;

export const markSudoActive = () => {
    lastSudoTimestamp = Date.now();
};

export const resetSudo = () => {
    lastSudoTimestamp = 0;
};

export const isSudoActive = () => {
    return Date.now() - lastSudoTimestamp < SUDO_WINDOW_MS;
};
