export class CallRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private mixedStream: MediaStream | null = null;

  constructor() {}

  public startRecording(localStream: MediaStream, remoteStream: MediaStream) {
    this.recordedChunks = [];
    this.mixedStream = new MediaStream();

    // 1. Mix Audio
    this.audioContext = new AudioContext();
    const dest = this.audioContext.createMediaStreamDestination();

    if (localStream.getAudioTracks().length > 0) {
      const localSource = this.audioContext.createMediaStreamSource(localStream);
      localSource.connect(dest);
    }

    if (remoteStream.getAudioTracks().length > 0) {
      const remoteSource = this.audioContext.createMediaStreamSource(remoteStream);
      remoteSource.connect(dest);
    }

    // Add mixed audio track to mixed stream
    if (dest.stream.getAudioTracks().length > 0) {
      this.mixedStream.addTrack(dest.stream.getAudioTracks()[0]);
    }

    // 2. Add Remote Video (Primary)
    // Ideally we would canvas mix, but for performance we just grab the remote video
    if (remoteStream.getVideoTracks().length > 0) {
      this.mixedStream.addTrack(remoteStream.getVideoTracks()[0].clone());
    } else if (localStream.getVideoTracks().length > 0) {
       // Fallback to local video if no remote video (e.g. self-test)
       this.mixedStream.addTrack(localStream.getVideoTracks()[0].clone());
    }

    // 3. Start Recorder
    try {
      this.mediaRecorder = new MediaRecorder(this.mixedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
    } catch (_e: unknown) {
      // Fallback for Safari/others
      this.mediaRecorder = new MediaRecorder(this.mixedStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // Collect chunks every second
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: 'video/webm'
        });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
    this.mixedStream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.mediaRecorder = null;
    this.mixedStream = null;
    this.audioContext = null;
  }
}
