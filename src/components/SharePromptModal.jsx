import React from 'react';
import './SharePromptModal.css';

const SharePromptModal = ({ fileUrl, onClose }) => {
  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=Check%20this%20file:%20${encodeURIComponent(fileUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmailShare = () => {
    const subject = 'Shared File';
    const body = `Check out this file: ${fileUrl}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="modal-overlay">
      <div className="share-modal-content">
        <h2>Share Exported File</h2>
        <p>You can share this file via:</p>
        <div className="share-options">
          <div className="share-option-button" onClick={handleWhatsAppShare}>
            <span className="share-icon">📱</span>
            WhatsApp
          </div>
          <div className="share-option-button" onClick={handleEmailShare}>
            <span className="share-icon">✉️</span>
            Email
          </div>
        </div>
        <button className="close-modal-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default SharePromptModal;
