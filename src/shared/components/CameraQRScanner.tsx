import React, { useRef, useState, useEffect } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CameraQRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (payload: string) => void;
  title?: string;
}

export const CameraQRScanner: React.FC<CameraQRScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Quét mã QR Điểm danh',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      if (!isOpen) return;
      setErrorMessage(null);
      setIsScanning(true);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          setCameraActive(true);

          const scan = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  canvas.width = videoRef.current.videoWidth;
                  canvas.height = videoRef.current.videoHeight;
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                  });

                  if (code && code.data) {
                    onScanSuccess(code.data);
                    onClose();
                    return;
                  }
                }
              }
            }
            animationFrameId = requestAnimationFrame(scan);
          };

          animationFrameId = requestAnimationFrame(scan);
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraActive(false);
        setErrorMessage('Không thể mở Camera (do thiết bị không cấp quyền hoặc đang chạy trong sandbox). Bạn có thể tải ảnh mã QR hoặc nhập mã phiên bên dưới.');
      }
    };

    if (isOpen) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, onClose, onScanSuccess]);

  // Handle uploading an image of QR code
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            onScanSuccess(code.data);
            onClose();
          } else {
            setErrorMessage('Không tìm thấy mã QR hợp lệ trong ảnh tải lên.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanSuccess(manualCode.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 text-white rounded-3xl p-5 w-full max-w-sm border border-slate-700 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Camera Container */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-dashed border-blue-500/50">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Guide Frame */}
          <div className="relative z-10 w-48 h-48 border-2 border-blue-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1 rounded-tl" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1 rounded-br" />
            <div className="w-full h-0.5 bg-blue-400/80 shadow-[0_0_8px_#3b82f6] animate-pulse" />
          </div>

          {!cameraActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-slate-900/90 text-xs text-slate-300">
              <Camera className="w-8 h-8 text-blue-400 mb-2 animate-bounce" />
              <span>Đang kết nối Camera thiết bị Android / Web...</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Alternative Check-in Options */}
        <div className="space-y-3 pt-2">
          {/* Upload image */}
          <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700 transition-colors">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Tải ảnh mã QR từ thư viện ảnh</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Quick Mock Code / Manual Session */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập mã phiên (VD: ES-8921)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Check-in
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
