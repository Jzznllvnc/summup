# PPTX Text Parser
A minimal, pure JavaScript parser for pptx files. It will extract all the text from the slides and return it as a string or a JSON object.

## Installation
```bash
npm i pptx-text-parser
```

### Dependencies
This module requires the following dependencies:
- [JSZip](https://github.com/Stuk/jszip/)
- [sax](https://github.com/isaacs/sax-js)

## Usage
To extract the text as a string, use:
```javascript
const pptxTextParser = require('pptx-text-parser');

pptxTextParser('path/to/pptx/file.pptx', _mode="text")
  .then((text) => {
    console.log(text)
    return true;
  }) .catch((err) => {
    console.log(err);
    return false;
  });
```

To extract the text as a JSON object, use:
```javascript
const pptxTextParser = require('pptx-text-parser');

pptxTextParser('path/to/pptx/file.pptx', _mode="json")
  .then((textJSON) => {
    console.log(textJSON);
  })
  .catch((err) => {
    console.log(err);
  });
```

## Testing
Note: The contents of the [`sample.pptx`](https://github.com/gsidhu/pptx-text-parser.js/blob/main/sample.pptx) file were generated using OpenAI's [ChatGPT](https://chat.openai.com/chat).

You can test the module on the `sample.pptx` file like so:
```javascript
let sampleFilepath = "./sample.pptx";
parse(sampleFilepath, _mode="text").then((result) => {
  console.log(result);
});
```

Switch `_mode` to `"json"` to get the output as a JSON object.


## Sample Output
Note: The output is truncated for brevity.
**Text**
```javascript
"""
---
Slide 0

How giving more pets and treats to dogs can help avert the global climate crisis
Buzo
---
Slide 1

Introduction
Hello everyone, my name is Buzo and today I will be discussing how giving more pets and treats to dogs can help avert the global climate crisis. Dogs are often considered man's best friend, but they can also be a valuable ally in the fight against climate change. Let's explore how this can be possible.
---
Slide 2

The Benefits of Owning a Dog
Owning a dog has numerous benefits for both the owner and the environment. Dogs provide companionship and improve mental and physical health, leading to a happier and healthier lifestyle. Furthermore, dogs can reduce household waste and energy consumption through their natural behaviors and habits.

...
"""
```
**JSON**
```javascript
{
  'Slide 0': 'How giving more pets and treats to dogs can help avert the global climate crisis\n' +
    'Buzo',
  'Slide 1': 'Introduction\n' +
    "Hello everyone, my name is Buzo and today I will be discussing how giving more pets and treats to dogs can help avert the global climate crisis. Dogs are often considered man's best friend, but they can also be a valuable ally in the fight against climate change. Let's explore how this can be possible.",
  'Slide 2': 'The Benefits of Owning a Dog\n' +
    'Owning a dog has numerous benefits for both the owner and the environment. Dogs provide companionship and improve mental and physical health, leading to a happier and healthier lifestyle. Furthermore, dogs can reduce household waste and energy consumption through their natural behaviors and habits.',
  ...
}
```

## License
[MIT © Gurjot Sidhu](https://thatgurjot.mit-license.org/)