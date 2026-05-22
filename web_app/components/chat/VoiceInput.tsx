import { Mic, Square, MessageSquare, Type } from "lucide-react";
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

export type VoiceMode = "dictation" | "conversation";

interface VoiceInputProps {
  onTranscription: (text: string, mode: VoiceMode, languageCode?: string) => void;
  isProcessing?: boolean;
}

export interface VoiceInputRef {
  startRecording: () => void;
  stopRecording: () => void;
  mode: VoiceMode;
}

export const VoiceInput = forwardRef<VoiceInputRef, VoiceInputProps>(({ onTranscription, isProcessing }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("dictation");
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs for raw PCM capture
  const pcmBufferRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;
      pcmBufferRef.current = [];

      // --- Use Web Audio API to capture RAW PCM data directly ---
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // ScriptProcessorNode to capture raw audio samples
      const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;
      source.connect(scriptNode);
      scriptNode.connect(audioContext.destination); // required for processing to work

      scriptNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Store a copy of the float32 samples
        pcmBufferRef.current.push(new Float32Array(inputData));
      };

      audioContextRef.current = audioContext;

      // --- Volume-based Silence Detection ---
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastSoundTime = Date.now();
      const startTime = Date.now();
      let hasStartedSpeaking = false;
      const SILENCE_THRESHOLD = 5;
      const SILENCE_DURATION = 3500;
      const MAX_DURATION = 20000;

      const checkVolume = () => {
        if (!streamRef.current || !streamRef.current.active) return;

        if (Date.now() - startTime >= MAX_DURATION) {
          console.log("Max 20s duration reached, turning off mic");
          stopRecording();
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        if (average > SILENCE_THRESHOLD) {
          if (!hasStartedSpeaking) console.log("Speech detected, starting silence countdown...");
          hasStartedSpeaking = true;
          lastSoundTime = Date.now();
        } else if (hasStartedSpeaking) {
          if (Date.now() - lastSoundTime > SILENCE_DURATION) {
            console.log("Silence auto-stop triggered");
            stopRecording();
            return;
          }
        }
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      setIsRecording(true);
      checkVolume();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const handleTranscription = async (audioBlob: Blob) => {
    try {
      console.log(`Sending audio blob: size=${audioBlob.size} bytes, type=${audioBlob.type}`);
      if (audioBlob.size < 5000) {
        console.warn("Audio blob is too small, likely no speech was captured.");
        if (mode === "conversation") {
          startRecording();
        }
        return;
      }
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.wav");
      formData.append("language_code", "unknown"); // auto-detect language

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMessage = "Server error";
        try {
          const errData = await response.json();
          errMessage = errData.detail || errMessage;
        } catch(e) {}
        throw new Error(`STT failed (${response.status}): ${errMessage}`);
      }

      const data = await response.json();
      console.log("Sarvam STT Full Response:", data);
      
      const transcriptText = data.transcript || data.text || data.data || (data.message && typeof data.message === "string" ? data.message : null);
      
      if (transcriptText && transcriptText.trim()) {
        const langCode = data.language_code || "hi-IN";
        onTranscription(transcriptText, mode, langCode);
      } else {
        console.warn("Empty or missing transcript in Sarvam STT response:", data);
        if (mode === "conversation") {
           console.log("Restarting conversation loop after empty transcription detection.");
           startRecording();
        }
      }
    } catch (error: any) {
      console.warn("Transcription failed:", error?.message || error);
      // If we are in conversation mode, pause for 3 seconds then try again to avoid spinning
      if (mode === "conversation") {
         console.log("Retrying conversation mode after error...");
         setTimeout(() => startRecording(), 3000);
      }
    }
  };

  const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
    const length = samples.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);   // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const stopRecording = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    // Disconnect ScriptProcessorNode
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      const sampleRate = audioContextRef.current.sampleRate;
      audioContextRef.current.close();

      // Merge all PCM buffers into a single Float32Array
      const totalLength = pcmBufferRef.current.reduce((acc, buf) => acc + buf.length, 0);
      const mergedBuffer = new Float32Array(totalLength);
      let writeOffset = 0;
      for (const buf of pcmBufferRef.current) {
        mergedBuffer.set(buf, writeOffset);
        writeOffset += buf.length;
      }

      console.log(`PCM capture: ${totalLength} samples at ${sampleRate}Hz = ${(totalLength / sampleRate).toFixed(1)}s, max amplitude: ${Math.max(...mergedBuffer.slice(0, 1000).map(Math.abs))}`);

      // Resample to 16kHz if needed
      let finalSamples = mergedBuffer;
      let finalRate = sampleRate;
      if (sampleRate !== 16000) {
        const ratio = 16000 / sampleRate;
        const newLength = Math.round(totalLength * ratio);
        const resampled = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = i / ratio;
          const idx = Math.floor(srcIdx);
          const frac = srcIdx - idx;
          resampled[i] = (1 - frac) * (mergedBuffer[idx] || 0) + frac * (mergedBuffer[idx + 1] || 0);
        }
        finalSamples = resampled;
        finalRate = 16000;
      }

      const wavBlob = encodeWav(finalSamples, finalRate);
      console.log(`WAV blob created: ${wavBlob.size} bytes`);
      handleTranscription(wavBlob);
    }

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isRecording && !isProcessing) {
      setMode(prev => prev === "dictation" ? "conversation" : "dictation");
    }
  };

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    mode
  }));

  return (
    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 p-1 shadow-sm">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={cn(
          "p-2.5 rounded-full transition-all duration-300 flex items-center justify-center relative",
          isRecording
            ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30 scale-105"
            : "text-[#00634B] hover:bg-[#E6F0ED] dark:hover:bg-emerald-900/30",
          isProcessing ? "opacity-50 cursor-not-allowed" : ""
        )}
        title={isRecording ? "Stop Recording" : `Start Voice Input (${mode === "dictation" ? "Dictation" : "Conversation"})`}
      >
        {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
        {!isRecording && mode === "conversation" && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>
        )}
      </button>

      {/* Mode Toggle Split Button */}
      <button
        onClick={toggleMode}
        disabled={isRecording || isProcessing}
        className={cn(
          "p-2 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
          (isRecording || isProcessing) && "opacity-50 cursor-not-allowed"
        )}
        title={`Switch to ${mode === "dictation" ? "Conversation" : "Dictation"} mode`}
      >
        {mode === "dictation" ? <Type className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5 text-[#00634B]" />}
      </button>
    </div>
  );
});
