document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const fileInput = document.getElementById('file-upload');
    const fileNameSpan = document.getElementById('file-name');
    const summarizeBtn = document.getElementById('summarize-btn');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const summaryOutput = document.getElementById('summary-output');
    const summaryTextP = summaryOutput.querySelector('p');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const errorMessage = document.getElementById('error-message');

    let selectedFile = null;

    // Helper functions to manage UI state
    const showLoading = () => {
        loadingSpinner.classList.remove('spinner-hidden');
        summarizeBtn.disabled = true;
        fileInput.disabled = true;
        removeFileBtn.disabled = true;
        copySummaryBtn.disabled = true;
        summaryTextP.textContent = 'Summarizing your document...';
        summaryTextP.style.textAlign = 'center';
        errorMessage.classList.add('error-hidden');
        summarizeBtn.classList.remove('highlight-animation');
    };

    const hideLoading = () => {
        loadingSpinner.classList.add('spinner-hidden');
        summarizeBtn.disabled = !selectedFile;
        fileInput.disabled = false;
        removeFileBtn.disabled = !selectedFile;
        copySummaryBtn.disabled = false;
    };

    const showSummary = (summary) => {
        summaryTextP.textContent = summary;
        summaryTextP.style.textAlign = 'justify';
        copySummaryBtn.style.display = 'block';
        copySummaryBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copySummaryBtn.classList.remove('copied');
    };

    const showError = (message) => {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('error-hidden');
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        copySummaryBtn.style.display = 'none';
        summarizeBtn.classList.remove('highlight-animation');
    };

    const clearError = () => {
        errorMessage.classList.add('error-hidden');
        errorMessage.textContent = '';
    };

    // Function to reset file input state
    const resetFileInput = () => {
        selectedFile = null;
        fileInput.value = '';
        fileNameSpan.textContent = 'No file chosen';
        summarizeBtn.disabled = true;
        removeFileBtn.classList.remove('visible');
        clearError();
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        copySummaryBtn.style.display = 'none';
        summarizeBtn.classList.remove('highlight-animation');
    };

    // Event listener for file input change
    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            selectedFile = event.target.files[0];
            fileNameSpan.textContent = selectedFile.name;
            summarizeBtn.disabled = false;
            removeFileBtn.classList.add('visible');
            clearError();
            summaryTextP.textContent = 'Your summarized content will appear here.';
            copySummaryBtn.style.display = 'none';
            summarizeBtn.classList.add('highlight-animation');
        } else {
            resetFileInput();
        }
    });

    // Event listener for remove file button click
    removeFileBtn.addEventListener('click', () => {
        resetFileInput();
    });

    // Event listener for summarize button click
    summarizeBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showError('Please select a file first.');
            return;
        }
        summarizeBtn.classList.remove('highlight-animation');
        showLoading();
        clearError();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (data.summary) {
                showSummary(data.summary);
            } else {
                showError('No summary received.');
            }

        } catch (error) {
            console.error('Summarization failed:', error);
            showError(error.message || 'An unexpected error occurred during summarization.');
        } finally {
            hideLoading();
        }
    });

    // Event listener for copy summary button click
    copySummaryBtn.addEventListener('click', async () => {
        const summaryText = summaryOutput.querySelector('p').textContent;
        try {
            await navigator.clipboard.writeText(summaryText);
            copySummaryBtn.innerHTML = '<i class="fas fa-check"></i>';
            copySummaryBtn.classList.add('copied');
            setTimeout(() => {
                copySummaryBtn.innerHTML = '<i class="fas fa-copy"></i>';
                copySummaryBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showError('Failed to copy text.');
            setTimeout(() => clearError(), 3000);
        }
    });

    resetFileInput();
});