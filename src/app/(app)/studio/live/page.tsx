'use client';

/**
 * Live Studio - Real-Time Interaction Entry
 *
 * Flow: Open camera + mic → Real-time conversation → Generate edu video
 */

import { useState, useRef, useEffect } from 'react';
// import { useGeminiLive } from './hooks/useGeminiLive';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function LiveStudioPage() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startSession = async () => {
    setConnectionState('connecting');
    // TODO: Initialize Gemini Live session
    // const session = await createTutorSession();
    setConnectionState('connected');
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      // Stop camera
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      setIsCameraOn(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Back camera for objects
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // TODO: Start/stop audio capture and send to Live API
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 text-center border-b border-slate-700">
        <h1 className="text-xl font-bold">AI Visual Tutor</h1>
        <p className="text-sm text-slate-400">实时对话，看见就懂</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Camera view */}
        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${!isCameraOn && 'hidden'}`}
          />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-2">📷</div>
                <p className="text-slate-400">点击下方按钮打开摄像头</p>
              </div>
            </div>
          )}

          {/* Connection status */}
          <div className="absolute top-4 right-4">
            <div
              className={`px-3 py-1 rounded-full text-xs ${
                connectionState === 'connected'
                  ? 'bg-green-500/20 text-green-400'
                  : connectionState === 'connecting'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-slate-500/20 text-slate-400'
              }`}
            >
              {connectionState === 'connected'
                ? '🟢 已连接'
                : connectionState === 'connecting'
                  ? '🟡 连接中...'
                  : '⚪ 未连接'}
            </div>
          </div>

          {/* Listening indicator */}
          {isListening && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-sm">正在听...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              <p>打开摄像头，对准你想了解的东西</p>
              <p className="text-sm mt-1">然后问我"这是什么？"</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-center gap-6">
            {/* Camera toggle */}
            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isCameraOn ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span className="text-2xl">{isCameraOn ? '📷' : '📷'}</span>
            </button>

            {/* Mic / Listen button */}
            <button
              onClick={toggleListening}
              disabled={connectionState !== 'connected'}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 scale-110'
                  : connectionState === 'connected'
                    ? 'bg-green-600'
                    : 'bg-slate-600'
              }`}
            >
              <span className="text-3xl">{isListening ? '🎤' : '🎙️'}</span>
            </button>

            {/* Connect button (when disconnected) */}
            {connectionState === 'disconnected' && (
              <button
                onClick={startSession}
                className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center"
              >
                <span className="text-2xl">▶️</span>
              </button>
            )}
          </div>

          {connectionState === 'disconnected' && (
            <p className="text-center text-slate-400 text-sm mt-3">点击 ▶️ 开始对话</p>
          )}
        </div>
      </div>
    </div>
  );
}
