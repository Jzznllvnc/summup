const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const formidable = require('formidable');
const fs = require('fs/promises');
const mammoth = require('mammoth');
const CloudConvert = require('cloudconvert');

// --- Configuration ---
const API_KEY = process.env.GOOGLE_API_KEY;
const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;

// Log missing API keys (for development/debugging)
if (!API_KEY) {
    console.error("GOOGLE_API_KEY environment variable is not set.");
}
if (!CLOUDCONVERT_API_KEY) {
    console.error("CLOUDCONVERT_API_KEY environment variable is not set.");
}

// Initialize AI and CloudConvert clients
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

const generationConfig = {
    temperature: 0.2,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 4096,
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

function getSummarizationPrompt(fileCategory = 'document') {
    return `You are an elite, highly analytical summarization AI. Your objective is to produce an exceptionally accurate, coherent, thorough, and insightful summary of the provided ${fileCategory}.

CORE ACCURACY & FIDELITY DIRECTIVES:
1. STRICT FACTUAL GROUNDING: Rely exclusively on the facts, data, arguments, and conclusions directly present in the source. Do not assume, extrapolate, or introduce unsupported external information.
2. PRESERVE SPECIFICS: Faithfully retain exact numbers, percentages, dates, proper names, metrics, locations, and specialized terminology without generalizing or omitting critical details.
3. CONTEXT & NUANCE PRESERVATION: Accurately capture tone, context, caveats, methodologies, and relationships between ideas as conveyed by the source.
4. STANDALONE CLARITY: The summary must be detailed and self-contained so that the reader gains full comprehension without needing to reference the original document.

DYNAMIC STRUCTURE & FORMATTING (ADAPTIVE TO DOCUMENT CONTENT):
- DO NOT force rigid, generic cookie-cutter headers (avoid static, repetitive template categories).
- Dynamically tailor the structure, depth, and section headings (###) to naturally fit the document's specific subject matter, type, and complexity (e.g., technical reports, research papers, legal/business documents, meeting minutes, presentations, articles, or notes).
- Open with a clear, concise introductory synthesis capturing the document's core purpose, context, and overarching thesis.
- Group detailed insights under natural, context-specific topical headings that reflect the actual content.
- Use structured bullet points (-) with **bold descriptive lead-ins** for clarity and effortless scanning.
- Accurately integrate key figures, dates, and quantitative data within their relevant context.
- Conclude naturally with the major conclusions, key takeaways, recommendations, or next steps found in the source.
- Format cleanly in professional GitHub-flavored Markdown.`;
}

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

const cloudConvert = new CloudConvert(CLOUDCONVERT_API_KEY); 

const BACKEND_FORMIDABLE_MAX_MB = 200;
const GEMINI_IMAGE_PDF_MAX_MB = 45;
const CLOUDCONVERT_MAX_MB = 100;


module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Check if API keys are set
    if (!API_KEY || !CLOUDCONVERT_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: API Keys not set.' });
    }

    const form = new formidable.IncomingForm({
        multiples: false,
        maxFileSize: BACKEND_FORMIDABLE_MAX_MB * 1024 * 1024,
        uploadDir: require('os').tmpdir(), 
        keepExtensions: true,
    });

    let uploadedFile = null;

    try {
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    return reject(err);
                }
                resolve([fields, files]);
            });
        });
        
        uploadedFile = files.file;

        if (!uploadedFile || uploadedFile.length === 0) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const fileInfo = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
        let fileContentForAI; 
        let mimeType = fileInfo.mimetype;

        if (fileInfo.size > BACKEND_FORMIDABLE_MAX_MB * 1024 * 1024) {
             await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
             return res.status(413).json({ error: `File too large for server processing (max ${BACKEND_FORMIDABLE_MAX_MB}MB). Please compress it.` });
        }

        if (mimeType.startsWith('text/')) {
            fileContentForAI = await fs.readFile(fileInfo.filepath, 'utf8');

            const summarizationPrompt = getSummarizationPrompt('text document');

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: `${summarizationPrompt}\n\nDOCUMENT CONTENT:\n${fileContentForAI}` }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
            // Check specific Gemini limit for images/PDFs before reading into memory and encoding
            if (fileInfo.size > GEMINI_IMAGE_PDF_MAX_MB * 1024 * 1024) {
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                return res.status(413).json({ error: `Image/PDF file too large for AI processing (max ${GEMINI_IMAGE_PDF_MAX_MB}MB). Please compress it.` });
            }

            const imagePart = await fileToGenerativePart(fileInfo.filepath, mimeType);
            const summarizationPrompt = getSummarizationPrompt(mimeType === 'application/pdf' ? 'PDF document' : 'image document');

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [imagePart, { text: summarizationPrompt }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const { value: text } = await mammoth.extractRawText({ path: fileInfo.filepath });
            fileContentForAI = text;

            if (!fileContentForAI) {
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                return res.status(400).json({ error: 'Could not extract text from DOCX file. It might be empty or malformed.' });
            }

            const summarizationPrompt = getSummarizationPrompt('Word (DOCX) document');

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: `${summarizationPrompt}\n\nDOCUMENT CONTENT:\n${fileContentForAI}` }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            const summary = response.text();
            await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
            return res.status(200).json({ summary });

        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                   mimeType === 'application/vnd.ms-powerpoint') {
            // Check CloudConvert specific limit
            if (fileInfo.size > CLOUDCONVERT_MAX_MB * 1024 * 1024) {
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                return res.status(413).json({ error: `PPT/PPTX file too large for conversion (max ${CLOUDCONVERT_MAX_MB}MB). Please compress it.` });
            }

            if (!CLOUDCONVERT_API_KEY) {
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
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

                // After conversion, check if resulting PDF is too large for Gemini
                if (pdfBuffer.length > GEMINI_IMAGE_PDF_MAX_MB * 1024 * 1024) {
                    await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                    return res.status(413).json({ error: `Converted PDF file is too large for AI processing (max ${GEMINI_IMAGE_PDF_MAX_MB}MB). Please use a smaller PPT/PPTX file.` });
                }

                const pdfPart = {
                    inlineData: {
                        data: Buffer.from(pdfBuffer).toString('base64'),
                        mimeType: 'application/pdf'
                    },
                };

                const summarizationPrompt = getSummarizationPrompt('presentation slide deck');

                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [pdfPart, { text: summarizationPrompt }] }],
                    generationConfig,
                    safetySettings,
                });

                const finalSummaryResponse = result.response;
                const summary = finalSummaryResponse.text();
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                return res.status(200).json({ summary });

            } catch (convertError) {
                console.error('Error converting PPT/PPTX with CloudConvert or processing PDF with Gemini:', convertError);
                await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
                return res.status(500).json({ error: 'Failed to convert PPT/PPTX to PDF or summarize it. ' + convertError.message });
            }

        } else {
            await fs.unlink(fileInfo.filepath).catch(err => console.error('Error cleaning up temp file:', err));
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