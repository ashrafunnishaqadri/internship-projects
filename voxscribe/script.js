document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const btnText = document.getElementById('btn-text');
    const output = document.getElementById('output');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const languageSelect = document.getElementById('language-select');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const speakBtn = document.getElementById('speak-btn');
    const clearBtn = document.getElementById('clear-btn');
    const browserWarning = document.getElementById('browser-warning');

    // Speech Recognition Check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        browserWarning.style.display = 'block';
        recordBtn.disabled = true;
        recordBtn.style.opacity = '0.5';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let isRecording = false;
    let finalTranscript = '';

    // Functions
    const updateUIState = (recording) => {
        if (recording) {
            recordBtn.classList.add('recording');
            btnText.textContent = 'Stop Recording';
            statusDot.classList.add('active');
            statusText.textContent = 'Listening...';
        } else {
            recordBtn.classList.remove('recording');
            btnText.textContent = 'Start Recording';
            statusDot.classList.remove('active');
            statusText.textContent = 'Ready to Record';
        }
    };

    // Event Handlers
    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.lang = languageSelect.value;
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        updateUIState(true);
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // ZERO LAG FEEDBACK: Merge final and interim into the main view
        output.innerHTML = `<span class="final-text">${finalTranscript}</span><span class="interim-text">${interimTranscript}</span>`;
        
        // Auto-scroll
        output.scrollTop = output.scrollHeight;
    };

    recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error === 'not-allowed') {
            alert('Please allow microphone access to use VoxScribe.');
        }
        isRecording = false;
        updateUIState(false);
    };

    recognition.onend = () => {
        isRecording = false;
        updateUIState(false);
    };

    // AI Worker Setup
    let worker = null;
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const aiStatus = document.getElementById('ai-status');
    const progressBar = document.getElementById('progress-bar');
    const aiMessage = document.getElementById('ai-message');

    const initWorker = () => {
        if (!worker) {
            worker = new Worker('worker.js', { type: 'module' });
            worker.addEventListener('message', handleWorkerMessage);
        }
        return worker;
    };

    const handleWorkerMessage = (event) => {
        const data = event.data;
        
        if (data.status === 'progress') {
            progressBar.style.width = `${data.progress}%`;
            aiMessage.textContent = `Downloading AI Model: ${Math.round(data.progress)}%`;
        } else if (data.status === 'done') {
             progressBar.style.width = `100%`;
             aiMessage.textContent = 'Transcribing Audio...';
        } else if (data.status === 'complete') {
            finalTranscript += (finalTranscript ? '\n' : '') + '[AI File Transcription]: ' + data.output.text + ' ';
            output.innerHTML = `<span class="final-text">${finalTranscript}</span>`;
            aiStatus.style.display = 'none';
            output.scrollTop = output.scrollHeight;
        } else if (data.status === 'error') {
            aiMessage.textContent = `Error: ${data.error}`;
            aiMessage.style.color = 'var(--error)';
        }
    };

    const decodeAudio = async (arrayBuffer) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        let float32Array = audioBuffer.getChannelData(0);
        if (audioBuffer.numberOfChannels > 1) {
            const channel2 = audioBuffer.getChannelData(1);
            for (let i = 0; i < float32Array.length; i++) {
                float32Array[i] = (float32Array[i] + channel2[i]) / 2;
            }
        }
        return float32Array;
    };

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        aiStatus.style.display = 'block';
        progressBar.style.width = '0%';
        aiMessage.textContent = 'Reading file...';

        try {
            const arrayBuffer = await file.arrayBuffer();
            aiMessage.textContent = 'Decoding audio...';
            const audioData = await decodeAudio(arrayBuffer);

            const aiWorker = initWorker();
            aiMessage.textContent = 'Initializing AI Engine...';
            aiWorker.postMessage({
                action: 'transcribe',
                audioData: audioData
            });
        } catch (error) {
            aiMessage.textContent = `Error: ${error.message}`;
            aiMessage.style.color = 'var(--error)';
        }
    });

    // UI Controls
    copyBtn.addEventListener('click', () => {
        const textData = output.innerText || output.textContent;
        if (textData) {
            navigator.clipboard.writeText(textData).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = originalText, 2000);
            });
        }
    });

    downloadBtn.addEventListener('click', () => {
        const textData = output.innerText || output.textContent;
        if (!textData) return;
        const blob = new Blob([textData], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voxscribe_transcription_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    speakBtn.addEventListener('click', () => {
        const textData = output.innerText || output.textContent;
        if (textData) {
            const utterance = new SpeechSynthesisUtterance(textData);
            utterance.lang = languageSelect.value;
            window.speechSynthesis.speak(utterance);
        }
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your transcription?')) {
            finalTranscript = '';
            output.innerHTML = '';
        }
    });

    languageSelect.addEventListener('change', () => {
        if (isRecording) {
            recognition.stop();
            setTimeout(() => {
                recognition.lang = languageSelect.value;
                recognition.start();
            }, 500);
        }
    });
});
