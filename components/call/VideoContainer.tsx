import React, { useEffect, useRef } from 'react';

interface VideoContainerProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  muted?: boolean;
}

export const VideoContainer: React.FC<VideoContainerProps> = ({ stream, isLocal, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ 
      position: 'relative', 
      width: isLocal ? '150px' : '100%', 
      height: isLocal ? '100px' : '100%',
      backgroundColor: '#000',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted || isLocal} // Always mute local to prevent feedback
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          transform: isLocal ? 'scaleX(-1)' : 'none' // Mirror local video
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        color: 'white',
        fontSize: '12px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '2px 6px',
        borderRadius: '4px'
      }}>
        {isLocal ? 'You' : 'Remote'}
      </div>
    </div>
  );
};
