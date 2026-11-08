// Capte le micro et envoie des blocs d'environ 40 ms (Float32, à la fréquence du téléphone) à la page, qui les convertit.
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.count = 0;
    this.target = Math.round(sampleRate * 0.04);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.chunks.push(new Float32Array(channel));
      this.count += channel.length;
      if (this.count >= this.target) {
        const block = new Float32Array(this.count);
        let offset = 0;
        for (const chunk of this.chunks) {
          block.set(chunk, offset);
          offset += chunk.length;
        }
        this.chunks = [];
        this.count = 0;
        this.port.postMessage(block, [block.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
