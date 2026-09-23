function installDevToolsGuard() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) {
            e.preventDefault();
        }
    });
}

module.exports = { installDevToolsGuard };