import React from 'react';

interface CallControlsProps {
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleRecord: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  isRecording: boolean;
}

export const CallControls: React.FC<CallControlsProps> = ({
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleRecord,
  isMuted,
  isVideoOff,
  isRecording
}) => {
  const buttonStyle = {
    padding: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    margin: '0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px'
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderRadius: '30px',
      position: 'absolute',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10
    }}>
      <button 
        onClick={onToggleMute}
        style={{ ...buttonStyle, backgroundColor: isMuted ? '#ff4444' : '#444', color: 'white' }}
        title="Mute"
      >
        {isMuted ? '🔇' : '🎤'}
      </button>
      
      <button 
        onClick={onEndCall}
        style={{ ...buttonStyle, backgroundColor: '#ff4444', color: 'white', width: '56px', height: '56px' }}
        title="End Call"
      >
        📞
      </button>

      <button 
        onClick={onToggleVideo}
        style={{ ...buttonStyle, backgroundColor: isVideoOff ? '#ff4444' : '#444', color: 'white' }}
        title="Toggle Video"
      >
        {isVideoOff ? '📷' : '📹'}
      </button>

      <button 
        onClick={onToggleRecord}
        style={{ ...buttonStyle, backgroundColor: isRecording ? '#ff4444' : '#444', color: 'white' }}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? '⏹️' : '⏺️'}
      </button>
    </div>
  );
};
