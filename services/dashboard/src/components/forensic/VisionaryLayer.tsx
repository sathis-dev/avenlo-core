// ====================================
// VISIONARY LAYER COMPONENT
// Layer 3: GPT-4o Vision OCR Analysis
// ====================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, AlertTriangle, Image as ImageIcon, ScanLine, FileWarning, Fingerprint, X } from 'lucide-react';
import { ImageAnalysis } from '../../types/guardian';

interface VisionaryLayerProps {
  imageAnalysis?: ImageAnalysis;
  attachmentUrls: string[];
  isActive: boolean;
}

/**
 * OCR Highlight Overlay
 * Shows detected text regions on the image
 */
function OCROverlay({ 
  imageUrl, 
  extractedText,
  scamIndicators,
  onClose 
}: { 
  imageUrl: string;
  extractedText?: string;
  scamIndicators: string[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-4xl max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Image with scan effect */}
        <div className="relative">
          <img 
            src={imageUrl} 
            alt="Analyzed content" 
            className="max-w-full rounded-xl border border-avenlo-border/50"
          />
          
          {/* Scanning animation overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Scan line */}
            <motion.div
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-avenlo-cyan to-transparent"
              initial={{ top: '0%' }}
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
            
            {/* Corner markers */}
            <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-avenlo-cyan" />
            <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-avenlo-cyan" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-avenlo-cyan" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-avenlo-cyan" />
          </motion.div>

          {/* Detected regions highlight */}
          {scamIndicators.length > 0 && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                background: 'linear-gradient(45deg, rgba(239, 68, 68, 0.1) 0%, transparent 50%, rgba(239, 68, 68, 0.1) 100%)',
              }}
            />
          )}
        </div>

        {/* Extracted text panel */}
        {extractedText && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 p-4 rounded-xl bg-avenlo-card/90 border border-avenlo-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <ScanLine className="w-4 h-4 text-avenlo-cyan" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Extracted Text (OCR)</span>
            </div>
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {extractedText}
            </pre>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Indicator Badge
 */
function IndicatorBadge({ text, type }: { text: string; type: 'scam' | 'nsfw' | 'steg' | 'icon' }) {
  const colors = {
    scam: 'bg-red-500/20 text-red-400 border-red-500/30',
    nsfw: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    steg: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`px-2 py-1 rounded-lg text-xs font-mono border ${colors[type]}`}
    >
      {text}
    </motion.span>
  );
}

export default function VisionaryLayer({
  imageAnalysis,
  attachmentUrls,
  isActive,
}: VisionaryLayerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const isVisionaryLayer = imageAnalysis && isActive;
  const hasImages = attachmentUrls.length > 0 || imageAnalysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`
        forensic-layer relative overflow-hidden rounded-xl border
        ${isVisionaryLayer
          ? 'border-avenlo-cyan/50 bg-avenlo-cyan/5'
          : 'border-avenlo-border/30 bg-avenlo-card/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-avenlo-border/30">
        <div className="flex items-center gap-3">
          <motion.div
            className={`p-2 rounded-lg ${isVisionaryLayer ? 'bg-avenlo-cyan/20' : 'bg-gray-700/50'}`}
            animate={isVisionaryLayer ? {
              boxShadow: ['0 0 10px rgba(0,212,255,0)', '0 0 25px rgba(0,212,255,0.4)', '0 0 10px rgba(0,212,255,0)']
            } : {}}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Eye className={`w-4 h-4 ${isVisionaryLayer ? 'text-avenlo-cyan' : 'text-gray-500'}`} />
          </motion.div>
          <div>
            <h4 className="font-semibold text-white">Layer 3: VISIONARY</h4>
            <p className="text-xs text-gray-500">GPT-4o Vision • Steganography Detection</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {imageAnalysis && (
            <span className={`
              px-2 py-1 rounded-full text-xs font-mono
              ${isVisionaryLayer ? 'bg-avenlo-cyan/20 text-avenlo-cyan' : 'bg-gray-700/50 text-gray-400'}
            `}>
              {imageAnalysis.confidence}% conf
            </span>
          )}
          {isVisionaryLayer && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 rounded-full text-xs font-bold bg-avenlo-cyan/20 text-avenlo-cyan"
            >
              ANALYZED
            </motion.span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {hasImages ? (
          <>
            {/* Image Thumbnails */}
            <div className="flex flex-wrap gap-3">
              {attachmentUrls.map((url, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setSelectedImage(url)}
                  className="relative group w-24 h-24 rounded-xl overflow-hidden border border-avenlo-border/50 hover:border-avenlo-cyan/50 transition-colors"
                >
                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  {imageAnalysis?.imageUrl === url && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-avenlo-cyan animate-pulse" />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Analysis Results */}
            {imageAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Threat Indicators */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Steganography */}
                  <div className={`
                    p-3 rounded-xl border text-center
                    ${imageAnalysis.steganographyDetected 
                      ? 'bg-orange-500/10 border-orange-500/30' 
                      : 'bg-gray-800/30 border-avenlo-border/30'
                    }
                  `}>
                    <Fingerprint className={`w-5 h-5 mx-auto mb-1 ${imageAnalysis.steganographyDetected ? 'text-orange-400' : 'text-gray-600'}`} />
                    <div className="text-xs text-gray-400">Steganography</div>
                    <div className={`text-sm font-bold ${imageAnalysis.steganographyDetected ? 'text-orange-400' : 'text-gray-500'}`}>
                      {imageAnalysis.steganographyDetected ? 'DETECTED' : 'Clean'}
                    </div>
                  </div>

                  {/* NSFW */}
                  <div className={`
                    p-3 rounded-xl border text-center
                    ${imageAnalysis.nsfwProbability > 50 
                      ? 'bg-pink-500/10 border-pink-500/30' 
                      : 'bg-gray-800/30 border-avenlo-border/30'
                    }
                  `}>
                    <FileWarning className={`w-5 h-5 mx-auto mb-1 ${imageAnalysis.nsfwProbability > 50 ? 'text-pink-400' : 'text-gray-600'}`} />
                    <div className="text-xs text-gray-400">NSFW Score</div>
                    <div className={`text-sm font-bold ${imageAnalysis.nsfwProbability > 50 ? 'text-pink-400' : 'text-gray-500'}`}>
                      {imageAnalysis.nsfwProbability}%
                    </div>
                  </div>

                  {/* Scam Indicators */}
                  <div className={`
                    p-3 rounded-xl border text-center
                    ${imageAnalysis.scamIndicators.length > 0 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-gray-800/30 border-avenlo-border/30'
                    }
                  `}>
                    <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${imageAnalysis.scamIndicators.length > 0 ? 'text-red-400' : 'text-gray-600'}`} />
                    <div className="text-xs text-gray-400">Scam Signals</div>
                    <div className={`text-sm font-bold ${imageAnalysis.scamIndicators.length > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {imageAnalysis.scamIndicators.length}
                    </div>
                  </div>
                </div>

                {/* Scam Indicators List */}
                {imageAnalysis.scamIndicators.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Scam Indicators Detected</span>
                    <div className="flex flex-wrap gap-2">
                      {imageAnalysis.scamIndicators.map((indicator, i) => (
                        <IndicatorBadge key={i} text={indicator} type="scam" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Iconography Flags */}
                {imageAnalysis.iconographyFlags.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Iconography Flags</span>
                    <div className="flex flex-wrap gap-2">
                      {imageAnalysis.iconographyFlags.map((flag, i) => (
                        <IndicatorBadge key={i} text={flag} type="icon" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Text Preview */}
                {imageAnalysis.extractedText && (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Extracted Text</span>
                    <div className="p-3 rounded-lg bg-black/30 border border-avenlo-border/30">
                      <pre className="text-xs text-gray-400 font-mono line-clamp-3">
                        {imageAnalysis.extractedText}
                      </pre>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <ImageIcon className="w-8 h-8 mr-3 opacity-30" />
            <span className="text-sm">No images in this infraction</span>
          </div>
        )}
      </div>

      {/* OCR Overlay Modal */}
      <AnimatePresence>
        {selectedImage && imageAnalysis && (
          <OCROverlay
            imageUrl={selectedImage}
            extractedText={imageAnalysis.extractedText}
            scamIndicators={imageAnalysis.scamIndicators}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </AnimatePresence>

      {/* Active glow effect */}
      {isVisionaryLayer && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
          }}
        />
      )}
    </motion.div>
  );
}
