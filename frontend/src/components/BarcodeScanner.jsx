import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, X, RefreshCw, Sparkles } from 'lucide-react';

export default function BarcodeScanner({ onScan, onAISnap, onClose }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      oscillator.start(oscillator.frequency);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then(videoDevices => {
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          const defaultDevice = videoDevices[videoDevices.length - 1].deviceId;
          setSelectedDevice(defaultDevice);
        } else {
          setError('No camera devices found.');
        }
      })
      .catch(err => {
        console.error('Camera listing error:', err);
        setError('Failed to list camera devices. Check permissions.');
      });

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedDevice || !codeReaderRef.current) return;
    
    codeReaderRef.current.reset();
    setScanning(false);
    setError('');

    setScanning(true);
    codeReaderRef.current.decodeFromVideoDevice(
      selectedDevice,
      videoRef.current,
      (result, err) => {
        if (result) {
          playBeep();
          onScan(result.getText());
        }
      }
    )
    .catch(err => {
      console.error('Camera start error:', err);
      setError('Could not access selected camera stream.');
      setScanning(false);
    });

  }, [selectedDevice, onScan]);

  const handleDeviceChange = (e) => {
    setSelectedDevice(e.target.value);
  };

  // Capture current video frame onto canvas and return a File object
  const handleSnapPhoto = () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Target dimensions (limiting size to save bandwidth/API token usage)
      const MAX_WIDTH = 1024;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera-frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onAISnap(file);
        } else {
          setError('Failed to process image frame.');
          setCapturing(false);
        }
      }, 'image/jpeg', 0.85); // JPEG compression ratio

    } catch (err) {
      console.error('Canvas capture failed:', err);
      setError('Failed to capture frame from video.');
      setCapturing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card" style={{ maxWidth: '480px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera className="text-primary" size={20} /> Ingestion Camera
          </h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
            {error}
          </div>
        ) : null}

        <div className="scanner-viewport">
          {scanning ? <div className="scanner-laser"></div> : null}
          <video 
            ref={videoRef} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline
            muted
          />
        </div>

        {/* Dynamic Snap Photo overlay */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSnapPhoto}
            disabled={capturing || !scanning}
            style={{ width: '100%', gap: '10px', height: '48px', background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
            {capturing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Snap Photo for AI Product Entry
          </button>

          <div>
            <label htmlFor="camera-select" style={{ fontSize: '12px' }}>Camera Device</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                id="camera-select"
                value={selectedDevice} 
                onChange={handleDeviceChange}
                style={{ flexGrow: 1 }}
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  if (devices.length > 1) {
                    const currentIdx = devices.findIndex(d => d.deviceId === selectedDevice);
                    const nextIdx = (currentIdx + 1) % devices.length;
                    setSelectedDevice(devices[nextIdx].deviceId);
                  }
                }}
                disabled={devices.length <= 1}
                style={{ padding: '12px' }}
                title="Switch Camera"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Edges analyze real-time barcodes automatically. Tap **AI Entry** to snap a packaging photo and auto-fill catalog details.
        </div>
      </div>
    </div>
  );
}
