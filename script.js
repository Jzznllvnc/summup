document.addEventListener('DOMContentLoaded', () => {

    const fileInput = document.getElementById('file-upload');
    const fileNameSpan = document.getElementById('file-name');
    const summarizeBtn = document.getElementById('summarize-btn');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const pptLoadingMessage = document.getElementById('ppt-loading-message');
    const summaryOutput = document.getElementById('summary-output');
    const summaryTextP = summaryOutput.querySelector('p');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const errorMessage = document.getElementById('error-message');
    const copyTextSpan = document.getElementById('copy-text-span'); 
    
    let selectedFile = null;

    const MAX_FILE_SIZE_MB_FRONTEND = 4;
    const MAX_FILE_SIZE_BYTES_FRONTEND = MAX_FILE_SIZE_MB_FRONTEND * 1024 * 1024;


    const showLoading = () => {
        loadingSpinner.classList.remove('spinner-hidden');
        summarizeBtn.disabled = true;
        fileInput.disabled = true;
        removeFileBtn.style.display = 'none';
        copySummaryBtn.disabled = true;
        if (copyTextSpan) {
            copyTextSpan.style.display = 'none';
        }
        copySummaryBtn.style.display = 'none';
        summaryTextP.textContent = 'Summarizing your document';
        summaryTextP.classList.add('animating-dots');
        summaryTextP.style.textAlign = 'center';
        errorMessage.classList.add('error-hidden');
        summarizeBtn.classList.remove('highlight-animation');
        
        if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                             selectedFile.type === 'application/vnd.ms-powerpoint')) {
            pptLoadingMessage.classList.remove('loading-message-hidden');
        }
    };

    const hideLoading = () => {
        loadingSpinner.classList.add('spinner-hidden');
        pptLoadingMessage.classList.add('loading-message-hidden');
        summarizeBtn.disabled = !selectedFile;
        fileInput.disabled = false;
        removeFileBtn.style.display = selectedFile ? 'block' : 'none';
        copySummaryBtn.disabled = false;
        summaryTextP.classList.remove('animating-dots');
    };

    const showSummary = (summary) => {
        summaryTextP.textContent = summary;
        summaryTextP.style.textAlign = 'justify';
        copySummaryBtn.style.display = 'flex';
        copySummaryBtn.innerHTML = '<span id="copy-text-span">Copy All</span><i class="fas fa-copy"></i>';
        
        const currentCopyTextSpan = copySummaryBtn.querySelector('#copy-text-span');
        if (currentCopyTextSpan) {
            currentCopyTextSpan.textContent = 'Copy All';
            currentCopyTextSpan.style.display = 'inline-block';
        }
        copySummaryBtn.classList.remove('copied');
        summaryTextP.classList.remove('animating-dots');
    };

    const showError = (message) => {
        console.log("showError called with message:", message);
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('error-hidden');
    };

    const clearError = () => {
        console.log("clearError called.");
        errorMessage.classList.add('error-hidden');
        errorMessage.textContent = '';
    };

    const resetFileInput = () => {
        console.log("resetFileInput called.");
        selectedFile = null;
        fileInput.value = '';
        fileNameSpan.textContent = 'No file chosen';
        summarizeBtn.disabled = true;
        removeFileBtn.classList.remove('visible');
        removeFileBtn.style.display = 'none';
        clearError();
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        copySummaryBtn.style.display = 'none';
        summarizeBtn.classList.remove('highlight-animation');
        pptLoadingMessage.classList.add('loading-message-hidden');
        summaryTextP.classList.remove('animating-dots');
    };

    // Event listener for file input change
    fileInput.addEventListener('change', (event) => {
        console.log('File input change event triggered.');
        if (event.target.files.length > 0) {
            selectedFile = event.target.files[0];
            console.log('File selected:', selectedFile.name, 'Size:', selectedFile.size, 'bytes');
            console.log('MAX_FILE_SIZE_BYTES_FRONTEND:', MAX_FILE_SIZE_BYTES_FRONTEND);

            // --- Frontend Client-Side File Size Check ---
            if (selectedFile.size > MAX_FILE_SIZE_BYTES_FRONTEND) {
                console.warn('File too large, client-side check hit! Displaying error.');
                showError(`File size exceeds the limit of ${MAX_FILE_SIZE_MB_FRONTEND}MB. Please compress it or use a smaller file.`);

                fileNameSpan.textContent = selectedFile.name;
                summarizeBtn.disabled = true;
                removeFileBtn.style.display = 'block';
                
                return;
            }

            console.log('File size acceptable on client-side.');
            fileNameSpan.textContent = selectedFile.name;
            summarizeBtn.disabled = false;
            removeFileBtn.classList.add('visible');
            removeFileBtn.style.display = 'block';
            clearError();
            summaryTextP.textContent = 'Your summarized content will appear here.';
            copySummaryBtn.style.display = 'none';
            summarizeBtn.classList.add('highlight-animation');
        } else {
            console.log('No file chosen or file selection cancelled.');
            resetFileInput();
        }
    });

    removeFileBtn.addEventListener('click', () => {
        resetFileInput();
        clearError();
    });

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
                let errorText = await response.text(); 
                
                try {
                    const errorData = JSON.parse(errorText); 
                    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
                } catch (jsonParseError) {
                    if (response.status === 413 || errorText.includes("Request Entity Too Large")) {
                        throw new Error(`Request Entity Too Large`);
                    } else {
                        throw new Error(`Server responded with non-JSON or status ${response.status}. Details: ${errorText.substring(0, 100)}...`);
                    }
                }
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

    copySummaryBtn.addEventListener('click', async () => {
        const summaryText = summaryOutput.querySelector('p').textContent;
        const currentCopyTextSpan = copySummaryBtn.querySelector('#copy-text-span'); 
        try {
            await navigator.clipboard.writeText(summaryText);
            copySummaryBtn.querySelector('i').classList.remove('fa-copy');
            copySummaryBtn.querySelector('i').classList.add('fa-check');
            if (currentCopyTextSpan) {
                currentCopyTextSpan.textContent = 'Copied!';
            }
            copySummaryBtn.classList.add('copied');
            setTimeout(() => {
                copySummaryBtn.querySelector('i').classList.remove('fa-check');
                copySummaryBtn.querySelector('i').classList.add('fa-copy');
                if (currentCopyTextSpan) {
                    currentCopyTextSpan.textContent = 'Copy All';
                }
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