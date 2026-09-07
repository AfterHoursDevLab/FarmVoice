/**
 * AudioWorklet: converts Float32 mic frames to 24kHz PCM16 and posts the raw
 * bytes to the main thread, where they are base64-encoded and streamed to the
 * AssemblyAI Voice Agent API as `input.audio`.
 */
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const channel = input[0];
      if (channel) {
        const pcm = new Int16Array(channel.length);
        for (let i = 0; i < channel.length; i += 1) {
          const v = Math.max(-1, Math.min(1, channel[i]));
          pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);