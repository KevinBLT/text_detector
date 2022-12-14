const _importScripts = (...args) => Promise.resolve(self.importScripts(...args));

class TextDetectorWorker {
  
  static async start() {
    await _importScripts('text_decode_result.js');

    if (! ('TextDetector' in self)) {
      
      await _importScripts(
        'tensorflow/tensorflow_text_detector.js', 
        'tensorflow/tfjs.min.js', 
        'opencv/opencv.js'
      );
      
      await _TextDetector.initilize();

      self.TextDetector  = _TextDetector;
      self._TextDetector = true;
    }

    const textDetector = new TextDetector();
  
    self.addEventListener('message', async (messageEvent) => {
      let id            = messageEvent.data.id,
          time          = messageEvent.data.time,
          decoder       = self._TextDetector ? 'tensorflow' : 'native',
          textLines     = [],
          maxLineHeight = 0,
          result        = null,
          buffer        = new ImageData(
            new Uint8ClampedArray(messageEvent.data.buffer), 
            messageEvent.data.size.width  || Math.sqrt(messageEvent.data.buffer.byteLength) / 2,
            messageEvent.data.size.height || Math.sqrt(messageEvent.data.buffer.byteLength) / 2
          );
      
      result = await textDetector.detect(buffer);

      for (let e of result) {
        let mid   = e.boundingBox.y + e.boundingBox.height / 2, 
            found = false,
            sx    = 1 / messageEvent.data.size.scaleX, 
            sy    = 1 / messageEvent.data.size.scaleY;

        maxLineHeight = Math.max(maxLineHeight, e.boundingBox.height);

        for (let c of e.cornerPoints) {
          c.x *= sx;
          c.y *= sy;
        }

        TextDecodeResult.prototype.setCornerPoints.call(e, e.cornerPoints);
        TextDecodeResult.prototype.update.call(e);

        for (let textLine of textLines) {
          if (Math.abs(textLine.mid - mid) < maxLineHeight / 2) {
            textLine.parts.push(e);

            textLine.parts.sort(
              (a, b) => a.boundingBox.x == b.boundingBox.x ? 0 : 
                        a.boundingBox.x > b.boundingBox.x ? 1 : -1
            );

            found = true; break;
          }
        }

        if (!found) {
          textLines.push({ mid, parts: [e] });
        }

      }
      
      textLines = textLines.map(e => e.parts.map(p => p.rawValue).join(' '));

      self.postMessage({ result, id, time, decoder, textLines, fullText: textLines.join('\n') });

    });
  
    self.postMessage({ id: 0 });
  }

}

TextDetectorWorker.start();