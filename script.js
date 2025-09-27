document.addEventListener('DOMContentLoaded', () => {

    const fileInput = document.getElementById('file-upload');
    const fileNameSpan = document.getElementById('file-name');
    const summarizeBtn = document.getElementById('summarize-btn');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const aiLoaderContainer = document.getElementById('ai-loader-container');
    const loadingText = document.getElementById('loading-text');
    const pptLoadingMessage = document.getElementById('ppt-loading-message');
    const summaryOutput = document.getElementById('summary-output');
    const summaryTextP = document.getElementById('summary-text');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const clearSummaryBtn = document.getElementById('clear-summary-btn');
    const errorMessage = document.getElementById('error-message');
    const copyTextSpan = document.getElementById('copy-text-span'); 
    
    let selectedFile = null;

    const MAX_FILE_SIZE_MB_FRONTEND = 4.4;
    const MAX_FILE_SIZE_BYTES_FRONTEND = MAX_FILE_SIZE_MB_FRONTEND * 1024 * 1024;


    const showLoading = () => {
        // Show AI loader and hide regular content
        const aiLoader = document.getElementById('ai-loader');
        aiLoaderContainer.classList.remove('ai-loader-hidden');
        aiLoader.play(); // Start the animation
        summaryOutput.classList.add('loading');
        summaryTextP.style.display = 'none';
        
        // Disable UI elements
        summarizeBtn.disabled = true;
        fileInput.disabled = true;
        removeFileBtn.style.display = 'none';
        copySummaryBtn.disabled = true;
        copySummaryBtn.style.display = 'none';
        clearSummaryBtn.style.display = 'none';
        
        // Update loading text with animation
        loadingText.textContent = 'Summarizing your document';
        loadingText.classList.add('animating-dots');
        
        errorMessage.classList.add('error-hidden');
        summarizeBtn.classList.remove('highlight-animation');
        
        if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                             selectedFile.type === 'application/vnd.ms-powerpoint')) {
            pptLoadingMessage.classList.remove('loading-message-hidden');
        }
    };

    const hideLoading = () => {
        // Hide AI loader and restore normal state
        const aiLoader = document.getElementById('ai-loader');
        aiLoader.stop(); // Stop the animation
        aiLoaderContainer.classList.add('ai-loader-hidden');
        summaryOutput.classList.remove('loading');
        summaryTextP.style.display = 'block';
        
        pptLoadingMessage.classList.add('loading-message-hidden');
        summarizeBtn.disabled = !selectedFile;
        fileInput.disabled = false;
        removeFileBtn.style.display = selectedFile ? 'block' : 'none';
        copySummaryBtn.disabled = false;
        loadingText.classList.remove('animating-dots');
    };

    const showSummary = (summary) => {
        // Hide AI loader and show summary
        const aiLoader = document.getElementById('ai-loader');
        aiLoader.stop(); // Stop the animation
        aiLoaderContainer.classList.add('ai-loader-hidden');
        summaryOutput.classList.remove('loading');
        summaryTextP.style.display = 'block';
        
        summaryTextP.textContent = summary;
        summaryTextP.style.textAlign = 'justify';
        copySummaryBtn.style.display = 'flex';
        clearSummaryBtn.style.display = 'flex';
        copySummaryBtn.innerHTML = '<span id="copy-text-span">Copy All</span><i data-lucide="copy"></i>';
        clearSummaryBtn.innerHTML = '<span id="clear-text-span">Clear</span><i data-lucide="eraser"></i>';
        lucide.createIcons();
        
        const currentCopyTextSpan = copySummaryBtn.querySelector('#copy-text-span');
        if (currentCopyTextSpan) {
            currentCopyTextSpan.textContent = 'Copy All';
            currentCopyTextSpan.style.display = 'inline-block';
        }
        copySummaryBtn.classList.remove('copied');
    };

    const showError = (message) => {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('error-hidden');
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
        
        // Reset summary container to default state
        const aiLoader = document.getElementById('ai-loader');
        aiLoader.stop(); // Stop the animation
        aiLoaderContainer.classList.add('ai-loader-hidden');
        summaryOutput.classList.remove('loading');
        summaryTextP.style.display = 'block';
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        
        copySummaryBtn.style.display = 'none';
        clearSummaryBtn.style.display = 'none';
        summarizeBtn.classList.remove('highlight-animation');
        pptLoadingMessage.classList.add('loading-message-hidden');
    };

    // Event listener for file input change
    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            selectedFile = event.target.files[0];

            // --- Frontend Client-Side File Size Check ---
            if (selectedFile.size > MAX_FILE_SIZE_BYTES_FRONTEND) {
                showError(`File size exceeds the limit of ${MAX_FILE_SIZE_MB_FRONTEND}MB. Please compress it or use a smaller file.`);

                fileNameSpan.textContent = selectedFile.name;
                summarizeBtn.disabled = true;
                removeFileBtn.style.display = 'block';
                
                return;
            }

            fileNameSpan.textContent = selectedFile.name;
            summarizeBtn.disabled = false;
            removeFileBtn.classList.add('visible');
            removeFileBtn.style.display = 'block';
            clearError();
            
            // Reset summary container to default state when new file selected
            const aiLoader = document.getElementById('ai-loader');
            aiLoader.stop(); // Stop the animation
            aiLoaderContainer.classList.add('ai-loader-hidden');
            summaryOutput.classList.remove('loading');
            summaryTextP.style.display = 'block';
            summaryTextP.textContent = 'Your summarized content will appear here.';
            summaryTextP.style.textAlign = 'center';
            
            copySummaryBtn.style.display = 'none';
            clearSummaryBtn.style.display = 'none';
            summarizeBtn.classList.add('highlight-animation');
        } else {
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
                        throw new Error(`File size too large, please compress or upload files 4.4MB below.`);
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
        const summaryText = summaryTextP.textContent;
        const currentCopyTextSpan = copySummaryBtn.querySelector('#copy-text-span'); 
        try {
            await navigator.clipboard.writeText(summaryText);
            
            // Replace icon with check mark
            const iconContainer = copySummaryBtn.querySelector('[data-lucide], svg');
            if (iconContainer) {
                if (iconContainer.tagName === 'svg') {
                    // Replace SVG with new i element
                    const newIcon = document.createElement('i');
                    newIcon.setAttribute('data-lucide', 'check');
                    iconContainer.parentNode.replaceChild(newIcon, iconContainer);
                } else {
                    // It's still an i element
                    iconContainer.setAttribute('data-lucide', 'check');
                }
                lucide.createIcons();
            }
            
            if (currentCopyTextSpan) {
                currentCopyTextSpan.textContent = 'Copied!';
            }
            copySummaryBtn.classList.add('copied');
            
            setTimeout(() => {
                // Replace back to copy icon
                const checkIcon = copySummaryBtn.querySelector('[data-lucide], svg');
                if (checkIcon) {
                    if (checkIcon.tagName === 'svg') {
                        const newIcon = document.createElement('i');
                        newIcon.setAttribute('data-lucide', 'copy');
                        checkIcon.parentNode.replaceChild(newIcon, checkIcon);
                    } else {
                        checkIcon.setAttribute('data-lucide', 'copy');
                    }
                    lucide.createIcons();
                }
                
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

    clearSummaryBtn.addEventListener('click', () => {
        // Clear the summary and reset to default state
        const aiLoader = document.getElementById('ai-loader');
        aiLoader.stop(); // Stop the animation
        aiLoaderContainer.classList.add('ai-loader-hidden');
        summaryOutput.classList.remove('loading');
        summaryTextP.style.display = 'block';
        summaryTextP.textContent = 'Your summarized content will appear here.';
        summaryTextP.style.textAlign = 'center';
        copySummaryBtn.style.display = 'none';
        clearSummaryBtn.style.display = 'none';
        
        // Reset copy button state
        copySummaryBtn.classList.remove('copied');
        const currentCopyTextSpan = copySummaryBtn.querySelector('#copy-text-span');
        if (currentCopyTextSpan) {
            currentCopyTextSpan.textContent = 'Copy All';
        }
        
        // Reset copy button icon
        const copyIcon = copySummaryBtn.querySelector('[data-lucide], svg');
        if (copyIcon) {
            if (copyIcon.tagName === 'svg') {
                const newIcon = document.createElement('i');
                newIcon.setAttribute('data-lucide', 'copy');
                copyIcon.parentNode.replaceChild(newIcon, copyIcon);
            } else {
                copyIcon.setAttribute('data-lucide', 'copy');
            }
            lucide.createIcons();
        }
    });

    resetFileInput();
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Initialize Vanta.js animated background
    VANTA.HALO({
        el: "#vanta-bg",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: window.innerHeight,
        minWidth: window.innerWidth,
        xOffset: 0.10,  // Slight right offset to counteract left bias
        yOffset: 0.10,  // Slight down offset for balance
        size: 1.50,     // Large size for full coverage
        baseColor: 0x5790ab,     // Your primary accent color
        backgroundColor: 0x072d44, // Your body background
        amplitudeFactor: 3.00,   // Maximum amplitude for all-around spread
        speed: 0.50              // Slower for smoother movement
    });
});