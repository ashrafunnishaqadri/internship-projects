// worker.js
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Skip local checks for models; always fetch from Hugging Face
env.allowLocalModels = false;

/**
 * Singleton class for loading the pipeline
 */
class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { 
                progress_callback 
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { action, audioData } = event.data;

    if (action === 'transcribe') {
        try {
            // Load or retrieve the singleton instance
            const transcriber = await PipelineSingleton.getInstance(progress => {
                // Send progress updates back to the main thread
                self.postMessage(progress);
            });

            // Perform transcription
            const output = await transcriber(audioData, {
                chunk_length_s: 30,
                stride_length_s: 5,
                callback_function: (data) => {
                    // (Optional) Interim results can be sent here if needed
                }
            });

            // Send final result back to the main thread
            self.postMessage({
                status: 'complete',
                output: output
            });

        } catch (error) {
            self.postMessage({
                status: 'error',
                error: error.message
            });
        }
    }
});
