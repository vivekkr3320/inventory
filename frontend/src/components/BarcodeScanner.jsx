import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, X, RefreshCw } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  // Play a brief high-pitched synthetic beep to confirm barcode scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // Hz
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  useEffect(() => {
    // 1. Initialize Reader & List Video Devices
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then(videoDevices => {
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Default to the last device, which is usually the rear/main camera on mobile
          const defaultDevice = videoDevices[videoDevices.length - 1].deviceId;
          setSelectedDevice(defaultDevice);
        } else {
          setError('No camera devices found.');
        }
      })
      .catch(err => {
        console.error('Camera listing error:', err);
        setError('Failed to list camera devices. Check browser permissions.');
      });

    return () => {
      // Cleanup: stop scanning on unmount
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedDevice || !codeReaderRef.current) return;
    
    // Reset previous stream
    codeReaderRef.current.reset();
    setScanning(false);
    setError('');

    // Start decoding from selected camera
    setScanning(true);
    codeReaderRef.current.decodeFromVideoDevice(
      selectedDevice,
      videoRef.current,
      (result, err) => {
        if (result) {
          playBeep();
          // Call callback with decoded text
          onScan(result.getText());
        }
        // err is thrown continuously if no barcode is in view, which is expected
      }
    )
    .catch(err => {
      console.error('Camera start error:', err);
      setError('Could not access selected camera stream. Ensure HTTPS is active.');
      setScanning(false);
    });

  }, [selectedDevice, onScan]);

  const handleDeviceChange = (e) => {
    setSelectedDevice(e.target.value);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card" style={{ maxWidth: '480px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera className="text-primary" size={20} /> Scan Barcode
          </h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
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

        <div style={{ marginTop: '16px' }}>
          <label htmlFor="camera-select">Select Camera Device</label>
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
                // Cycle cameras
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

        <div style={{ marginTop: '16px', fontSize: '12px', color: '--text-muted', textAlign: 'center' }}>
          Align the product barcode within the camera view to scan automatically.
        </div>
      </div>
    </div>
  );
}
