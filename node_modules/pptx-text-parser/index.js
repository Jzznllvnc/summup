
const fs = require('fs');
const JSZip = require("jszip");
const sax = require('sax');

async function extractTextFromPPTX(filepath, _mode="text") {
  let pptxFileBuffer = ''
  try {
    pptxFileBuffer = fs.readFileSync(filepath);
  } catch (err) {
    console.log(err);
    return ''
  }
  const slideXMLArray = await getSlideXML(pptxFileBuffer);
  const text = await parseSlideXML(slideXMLArray, _mode=_mode);
  return text;
}

// use JSZip to extract XML data from the pptx file buffer
async function getSlideXML(fileBuffer) {
  let slideXMLArray = [];
  const zip = await new JSZip().loadAsync(fileBuffer);
  // filter out the slide XML files
  const slideFiles = Object.keys(zip.files).filter((filename) =>
    filename.match(/slide\d+\.xml$/)
  );
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    const slideXML = await zip.files[slideFile].async("string");
    slideXMLArray.push(slideXML);
  }
  return slideXMLArray;
}

// use sax to parse the XML data
async function parseSlideXML(slideXMLArray, _mode="text") {
  let text = "";
  let json = {};

  for (let i = 0; i < slideXMLArray.length; i++) {
    const slideXML = slideXMLArray[i];
    const parser = sax.parser(true);
    const slideNum = "Slide " + i;
    let slideText = "";

    if (_mode === "text") {
      slideText += "\n---\n" + slideNum + "\n";
    } else if (_mode === "json") {
      json[slideNum] = ''
    }
    
    parser.onopentag = (node) => {
      if (node.name === "a:p") {
        slideText += "\n";
      }
    };
    
    parser.ontext = function (t) {
      if (t.trim()) {
        slideText += t;
      }
    };

    parser.write(slideXML.toString()).close();
    text += slideText;
    json[slideNum] = slideText.trim();
  }
  if (_mode === "text") {
    return text
  } else if (_mode === "json") {
    return json
  }
}

async function parse(filepath, _mode="text") {
  const text = await extractTextFromPPTX(filepath, _mode=_mode);
  return text;
}

module.exports = parse;