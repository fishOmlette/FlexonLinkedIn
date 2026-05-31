document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.sidePanel.open({ windowId: tab.windowId });
                    window.close(); // Close the small popup bubble once panel slides open
                }
            } catch (e) {
                console.error('[Flex on LinkedIn] Failed to open side panel:', e);
            }
        });
    }

    console.log('Flex on LinkedIn: Popup script loaded.');
});
