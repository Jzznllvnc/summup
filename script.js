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

    // --- Define Frontend File Size Limit ---
    // Based on your system's explanation, Gemini's direct input limit for Images/PDFs is ~50MB.
    // This is the most restrictive practical limit for AI processing.
    // Vercel's infrastructure limit for direct file uploads on free tier is ~4.5MB.
    // We'll use 45MB here as the client-side limit, which aligns with Gemini.
    // The backend will catch Vercel's 4.5MB limit.
    const MAX_FILE_SIZE_MB_FRONTEND = 45; // Setting to 45MB for client-side check, below Gemini's 50MB for safety.
    const MAX_FILE_SIZE_BYTES_FRONTEND = MAX_FILE_SIZE_MB_FRONTEND * 1024 * 1024; // Convert to bytes


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
        // Customize error messages based on common backend responses or known limits
        if (message.includes("File too large for server processing")) {
            errorMessage.textContent = `Error: File too large for server. Please compress it or upload a smaller file.`;
        } else if (message.includes("Image/PDF file too large for AI processing")) {
             errorMessage.textContent = `Error: Image/PDF file too large for AI processing (max ${MAX_FILE_SIZE_MB_FRONTEND}MB). Please compress it.`;
        } else if (message.includes("PPT/PPTX file too large for conversion")) {
             errorMessage.textContent = `Error: PPT/PPTX file too large for conversion. Please use a smaller file.`;
        } else if (message.includes("Converted PDF file is too large for AI processing")) {
             errorMessage.textContent = `Error: Converted file is too large for AI processing. Please use a smaller PPT/PPTX file.`;
        }
        // This is for Vercel's infrastructure-level 413, or other non-JSON responses
        else if (message.includes("Unexpected token 'R'") || message.includes("status of 413")) {
            // This happens when Vercel's edge network rejects a too-large request (e.g., >4.5MB on free tier)
            errorMessage.textContent = `Error: File size exceeds Vercel's server limit. Please upload a file smaller than ~4.5MB, or try another file type.`;
        }
        else {
            errorMessage.textContent = `Error: ${message}`;
        }

        errorMessage.classList.remove('error-hidden');
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        copySummaryBtn.style.display = 'none';
        summarizeBtn.classList.remove('highlight-animation');
        pptLoadingMessage.classList.add('loading-message-hidden');
        summaryTextP.classList.remove('animating-dots');
    };

    const clearError = () => {
        errorMessage.classList.add('error-hidden');
        errorMessage.textContent = '';
    };

    const resetFileInput = () => {
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
        if (event.target.files.length > 0) {
            selectedFile = event.target.files[0];

            // --- Frontend Client-Side File Size Check ---
            if (selectedFile.size > MAX_FILE_SIZE_BYTES_FRONTEND) {
                showError(`File size exceeds the client-side limit of ${MAX_FILE_SIZE_MB_FRONTEND}MB. Please compress it or use a smaller file.`);
                resetFileInput();
                return; // Stop further processing
            }

            fileNameSpan.textContent = selectedFile.name;
            summarizeBtn.disabled = false;
            removeFileBtn.classList.add('visible');
            removeFileBtn.style.display = 'block';
            clearError();
            summaryTextP.textContent = 'Your summarized content will appear here.';
            copySummaryBtn.style.display = 'none';
            summarizeBtn.classList.add('highlight-animation');
        } else {
            resetFileInput();
        }
    });

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
                // Try to parse JSON error first
                try {
                    const errorData = await response.json();
                    // If backend sends a specific error.error message, use that
                    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
                } catch (jsonParseError) {
                    // This catch block handles cases where the server sends non-JSON
                    // (e.g., an HTML error page from Vercel's infrastructure for 413)
                    if (response.status === 413) {
                         throw new Error(`status of 413`); // Use this specific string to trigger custom message
                    } else {
                        throw new Error(`Server responded with non-JSON or status ${response.status}.`);
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
            // Pass the error message to showError to handle custom display
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