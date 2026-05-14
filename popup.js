document.addEventListener('DOMContentLoaded', () => {
    const reportBtn = document.getElementById('report-btn');

    // Make the report button work
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            // Open GitHub issues or a contact link
            window.open('https://github.com/fishOmlette/FlexonLinkedIn/issues', '_blank');
        });
    }

    // Log for debugging
    console.log('Flex on LinkedIn: Popup script loaded.');
});
