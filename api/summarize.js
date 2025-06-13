const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const formidable = require('formidable');
const fs = require('fs/promises');
const mammoth = require('mammoth');
const CloudConvert = require('cloudconvert');

// --- Configuration ---
const API_KEY = process.env.GOOGLE_API_KEY;
const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;

if (!API_KEY) {
    console.error("GOOGLE_API_KEY environment variable is not set.");
}
if (!CLOUDCONVERT_API_KEY) {
    console.error("CLOUDCONVERT_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const generationConfig = {
    temperature: 0.2,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 800,
    responseMimeType: "text/plain",
};

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

// Helper to convert a file to a GoogleGenerativeAI.Part for multimodal input
async function fileToGenerativePart(filePath, mimeType) {
    try {
        const data = await fs.readFile(filePath);
        return {
            inlineData: {
                data: Buffer.from(data).toString('base64'),
                mimeType
            },
        };
    } catch (error) {
        console.error(`Error reading file for GenerativePart: ${error.message}`);
        throw new Error('Failed to read file for AI processing.');
    }
}

// The CloudConvert SDK takes the API key directly
const cloudConvert = new CloudConvert(CLOUDCONVERT_API_KEY); 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY || !CLOUDCONVERT_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: API Keys not set.' });
    }

    const form = new formidable.IncomingForm({ multiples: false });

    try {
        const [fields, files] = await form.parse(req);
        const uploadedFile = files.file;

        if (!uploadedFile || uploadedFile.length === 0) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const fileInfo = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
        let fileContentForAI; 
        let mimeType = fileInfo.mimetype;

        if (mimeType.startsWith('text/')) {
            fileContentForAI = await fs.readFile(fileInfo.filepath, 'utf8');

            let summarizationPrompt = `
                Summarize the following document clearly and thoroughly.

                1. START WITH A BRIEF OVERVIEW explaining the main objective, topic, or theme of the document.
                2. FOLLOW WITH KEY DETAILS presented as a list using hyphens (-). IF THE DOCUMENT HAS SECTIONS (e.g., INTRODUCTION, ANALYSIS, CONCLUSION), REFLECT THAT STRUCTURE IN THE SUMMARY.
                3. USE ALL CAPITAL LETTERS to emphasize important facts, names, figures, and key terms.
                4. DO NOT USE ASTERISKS, BOLD MARKDOWN, OR DOUBLE ASTERISK FORMATTING FOR HEADINGS OR EMPHASIS. USE ALL CAPITAL LETTERS INSTEAD.
                5. INCLUDE RELEVANT NAMES, DATES, LOCATIONS, STATISTICS, AND TERMINOLOGY EXACTLY AS STATED in the source when appropriate.
                6. AVOID GENERALIZING—include specific facts and supporting details that clarify the summary.
                7. IF THERE ARE INSIGHTS, RECOMMENDATIONS, OR CONCLUSIONS, PLACE THEM UNDER A FINAL BULLET CALLED "INSIGHTS" or "CONCLUSION".
                8. THE SUMMARY SHOULD STAND ALONE—even if the reader does not have access to the original file. Be thorough, concise, and preserve meaning.`;

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: `${summarizationPrompt}\n\n${fileContentForAI}` }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath);
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
            const imagePart = await fileToGenerativePart(fileInfo.filepath, mimeType);

            let summarizationPrompt = `
                Summarize the content of this document/image as clearly and thoroughly as possible.

                1. START WITH a BRIEF PARAGRAPH that explains the overall purpose, topic, or focus of the document/image.
                2. THEN, LIST THE MOST IMPORTANT POINTS using hyphens (-) instead of asterisks.
                3. USE ALL CAPITAL LETTERS for emphasis when highlighting key data or important terms.
                4. DO NOT USE ASTERISKS, BOLD MARKDOWN, OR DOUBLE ASTERISK FORMATTING FOR HEADINGS OR EMPHASIS. USE ALL CAPITAL LETTERS INSTEAD.
                5. INCLUDE NUMERIC DATA, LABELS, NAMES, OR TITLES when available, instead of generalizing them.
                6. DO NOT OMIT relevant information, especially metrics, labels, section headers, or details that provide context.
                7. IF SECTIONS OR CATEGORIES are present, GROUP bullet points accordingly with subheadings for clarity.
                8. WRITE AS IF THE READER HAS NOT SEEN THE ORIGINAL FILE and needs a complete but concise summary. Be precise, comprehensive, and maintain clarity.`;

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [imagePart, { text: summarizationPrompt }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath);
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log('Processed DOCX file');
            const { value: text } = await mammoth.extractRawText({ path: fileInfo.filepath });
            fileContentForAI = text;

            if (!fileContentForAI) {
                await fs.unlink(fileInfo.filepath);
                return res.status(400).json({ error: 'Could not extract text from DOCX file. It might be empty or malformed.' });
            }

            let summarizationPrompt = `
                Summarize the following document clearly and thoroughly.

                1. START WITH A BRIEF OVERVIEW explaining the main objective, topic, or theme of the document.
                2. FOLLOW WITH KEY DETAILS presented as a list using hyphens (-). IF THE DOCUMENT HAS SECTIONS (e.g., INTRODUCTION, ANALYSIS, CONCLUSION), REFLECT THAT STRUCTURE IN THE SUMMARY.
                3. USE ALL CAPITAL LETTERS to emphasize important facts, names, figures, and key terms.
                4. DO NOT USE ASTERISKS, BOLD MARKDOWN, OR DOUBLE ASTERISK FORMATTING FOR HEADINGS OR EMPHASIS. USE ALL CAPITAL LETTERS INSTEAD.
                5. INCLUDE RELEVANT NAMES, DATES, LOCATIONS, STATISTICS, AND TERMINOLOGY EXACTLY AS STATED in the source when appropriate.
                6. AVOID GENERALIZING—include specific facts and supporting details that clarify the summary.
                7. IF THERE ARE INSIGHTS, RECOMMENDATIONS, OR CONCLUSIONS, PLACE THEM UNDER A FINAL BULLET CALLED "INSIGHTS" or "CONCLUSION".
                8. THE SUMMARY SHOULD STAND ALONE—even if the reader does not have access to the original file. Be thorough, concise, and preserve meaning.`;

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: `${summarizationPrompt}\n\n${fileContentForAI}` }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath);
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                   mimeType === 'application/vnd.ms-powerpoint') {
            console.log('Processed PPT/PPTX file for CloudConvert conversion to PDF');
            if (!CLOUDCONVERT_API_KEY) {
                await fs.unlink(fileInfo.filepath);
                return res.status(500).json({ error: 'CloudConvert API key is not set. Cannot process PPT/PPTX files.' });
            }

            try {
                // Convert PPTX to PDF using CloudConvert
                const job = await cloudConvert.jobs.create({
                    "tasks": {
                        "upload_file": {
                            "operation": "import/upload"
                        },
                        "convert_to_pdf": {
                            "operation": "convert",
                            "input": "upload_file",
                            "output_format": "pdf",
                            "filename": "output.pdf"
                        },
                        "export_pdf": {
                            "operation": "export/url",
                            "input": "convert_to_pdf"
                        }
                    }
                });

                // Get the upload task and upload the file
                const uploadTask = job.tasks.filter(task => task.name === "upload_file")[0];
                const pptxFileContentBuffer = await fs.readFile(fileInfo.filepath); 
                await cloudConvert.tasks.upload(uploadTask, pptxFileContentBuffer, fileInfo.originalFilename); 

                const finishedJob = await cloudConvert.jobs.wait(job.id);
                const exportedPdfUrl = finishedJob.tasks.filter(task => task.operation === "export/url")[0].result.files[0].url;
                const response = await fetch(exportedPdfUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download converted PDF: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const pdfBuffer = Buffer.from(arrayBuffer);

                const pdfPart = {
                    inlineData: {
                        data: Buffer.from(pdfBuffer).toString('base64'),
                        mimeType: 'application/pdf'
                    },
                };

                let summarizationPrompt = `
                    Summarize the content of this presentation (now in PDF form) as clearly and thoroughly as possible.

                    1. START WITH a BRIEF PARAGRAPH that explains the overall purpose, topic, or focus of the document/image.
                    2. THEN, LIST THE MOST IMPORTANT POINTS using hyphens (-) instead of asterisks.
                    3. USE ALL CAPITAL LETTERS for emphasis when highlighting key data or important terms.
                    4. DO NOT USE ASTERISKS, BOLD MARKDOWN, OR DOUBLE ASTERISK FORMATTING FOR HEADINGS OR EMPHASIS. USE ALL CAPITAL LETTERS INSTEAD.
                    5. INCLUDE NUMERIC DATA, LABELS, NAMES, OR TITLES from slides when available, instead of generalizing them.
                    6. DO NOT OMIT relevant information, especially metrics, labels, section headers, or details that provide context from the slides.
                    7. IF SECTIONS OR CATEGORIES are present, GROUP bullet points accordingly with subheadings for clarity.
                    8. WRITE AS IF THE READER HAS NOT SEEN THE ORIGINAL PRESENTATION and needs a complete but concise summary. Be precise, comprehensive, and maintain clarity.`;

                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [pdfPart, { text: summarizationPrompt }] }],
                    generationConfig,
                    safetySettings,
                });

                const finalSummaryResponse = result.response;
                const summary = finalSummaryResponse.text();
                await fs.unlink(fileInfo.filepath);
                return res.status(200).json({ summary });

            } catch (convertError) {
                console.error('Error converting PPT/PPTX with CloudConvert or processing PDF with Gemini:', convertError);
                await fs.unlink(fileInfo.filepath);
                return res.status(500).json({ error: 'Failed to convert PPT/PPTX to PDF or summarize it. ' + convertError.message });
            }

        } else {
            await fs.unlink(fileInfo.filepath);
            return res.status(400).json({ error: `Unsupported file type: ${mimeType}. Please upload a PDF, DOCX, TXT, or common image format.` });
        }

    } catch (error) {
        console.error('Serverless function top-level error:', error);
        if (req.files && req.files.file && req.files.file.filepath) {
            await fs.unlink(req.files.file.filepath).catch(err => console.error('Error cleaning up temp file:', err));
        }
        res.status(500).json({ error: 'Failed to summarize document: ' + error.message });
    }
};