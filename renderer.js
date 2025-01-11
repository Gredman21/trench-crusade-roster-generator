const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    gerarPDF: async (content) => {
        try {
            return await ipcRenderer.invoke('gerar-pdf', content)
        } catch(e) {
            return {erro: e.message}
        }
    },

    fecharApp: () => {
        ipcRenderer.send('fechar-app')
    }
})
