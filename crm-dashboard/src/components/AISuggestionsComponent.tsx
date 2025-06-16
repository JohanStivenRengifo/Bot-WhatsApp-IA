import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Fade,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import {
  AutoFixHigh as AIIcon,
  ContentCopy as CopyIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Psychology as BrainIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAISuggestions } from '../hooks/useAISuggestions';
import type { SuggestedResponse } from '../hooks/useAISuggestions';

interface AISuggestionsComponentProps {
  conversationId: string;
  messages: any[];
  customerInfo?: any;
  onSuggestionSelect: (text: string) => void;
  onClose?: () => void;
}

const typeLabels = {
  professional: { label: 'Profesional', color: '#1976d2', icon: '💼' },
  empathetic: { label: 'Empática', color: '#388e3c', icon: '❤️' },
  proactive: { label: 'Proactiva', color: '#f57c00', icon: '💡' },
};

export const AISuggestionsComponent: React.FC<AISuggestionsComponentProps> = ({
  conversationId,
  messages,
  customerInfo,
  onSuggestionSelect,
  onClose,
}) => {
  const {
    suggestions,
    isLoading,
    error,
    generateSuggestions,
    clearSuggestions,
  } = useAISuggestions();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Simulate loading progress for better UX
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && !suggestions) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
    } else if (!isLoading) {
      setLoadingProgress(100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, suggestions]);
  const handleGenerateSuggestions = async () => {
    setLoadingProgress(0);
    await generateSuggestions(conversationId, messages, customerInfo);
    if (!error) {
      setShowSuccessSnackbar(true);
    }
  };

  const handleCopySuggestion = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const handleUseSuggestion = (text: string) => {
    onSuggestionSelect(text);
    if (onClose) {
      onClose();
    }
  };

  const handleClose = () => {
    clearSuggestions();
    setLoadingProgress(0);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'primary.light',
        maxHeight: '400px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <BrainIcon color="primary" />
          <Typography variant="h6" color="primary">
            Asistente IA
          </Typography>
          <Chip
            size="small"
            label="Azure OpenAI"
            color="primary"
            variant="outlined"
          />
        </Box>
        {onClose && (
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      {/* Generate Button */}
      {!suggestions && !isLoading && (
        <Box textAlign="center" py={2}>
          <Button
            variant="contained"
            startIcon={<AIIcon />}
            onClick={handleGenerateSuggestions}
            disabled={isLoading}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
              },
            }}
          >
            Generar Respuestas Sugeridas
          </Button>
          <Typography variant="body2" color="textSecondary" mt={1}>
            La IA analizará la conversación y sugerirá respuestas apropiadas
          </Typography>
        </Box>
      )}{' '}
      {/* Loading State */}
      {isLoading && (
        <Box textAlign="center" py={3}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            mb={2}
          >
            <BrainIcon color="primary" sx={{ mr: 1 }} />
            <CircularProgress size={24} />
          </Box>
          <LinearProgress
            variant="determinate"
            value={loadingProgress}
            sx={{
              mb: 2,
              borderRadius: 1,
              height: 6,
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              },
            }}
          />
          <Typography variant="body2" color="textSecondary">
            {loadingProgress < 30
              ? 'Analizando conversación...'
              : loadingProgress < 70
              ? 'Procesando contexto con IA...'
              : 'Generando respuestas personalizadas...'}
          </Typography>
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {Math.round(loadingProgress)}% completado
          </Typography>
        </Box>
      )}{' '}
      {/* Error State */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          icon={<WarningIcon />}
          action={
            <Button
              size="small"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={handleGenerateSuggestions}
              disabled={isLoading}
            >
              Reintentar
            </Button>
          }
        >
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Error al generar sugerencias:</strong>
          </Typography>
          <Typography variant="body2">{error}</Typography>
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ mt: 1, display: 'block' }}
          >
            Verifica tu conexión a internet e inténtalo nuevamente
          </Typography>
        </Alert>
      )}
      {/* Suggestions */}
      {suggestions && (
        <Fade in={true}>
          <Box>
            {/* Analysis */}
            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'grey.50' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="body2" color="textSecondary">
                  <strong>Análisis:</strong> {suggestions.analysis}
                </Typography>
              </CardContent>
            </Card>
            {/* Suggested Responses */}
            <Typography variant="subtitle2" gutterBottom>
              Respuestas Sugeridas:
            </Typography>
            <List disablePadding>
              {suggestions.suggestions.map(
                (suggestion: SuggestedResponse, index: number) => {
                  const typeConfig = typeLabels[suggestion.type];
                  return (
                    <ListItem
                      key={index}
                      sx={{
                        border: '1px solid',
                        borderColor: 'grey.300',
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: 'white',
                        '&:hover': {
                          bgcolor: 'grey.50',
                          borderColor: typeConfig.color,
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={0.5}
                          >
                            <Chip
                              size="small"
                              label={`${typeConfig.icon} ${typeConfig.label}`}
                              sx={{
                                bgcolor: typeConfig.color,
                                color: 'white',
                                fontSize: '0.75rem',
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {suggestion.text}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="Copiar texto">
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleCopySuggestion(suggestion.text, index)
                              }
                            >
                              {copiedIndex === index ? (
                                <CheckIcon color="success" />
                              ) : (
                                <CopyIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Usar esta respuesta">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() =>
                                handleUseSuggestion(suggestion.text)
                              }
                            >
                              <SendIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                }
              )}
            </List>
            <Divider sx={{ my: 2 }} /> {/* Footer */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="caption" color="textSecondary">
                Generado:{' '}
                {new Date(suggestions.generatedAt).toLocaleTimeString()}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleGenerateSuggestions}
                disabled={isLoading}
              >
                Regenerar
              </Button>
            </Box>
          </Box>
        </Fade>
      )}
      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="success"
          onClose={() => setShowSuccessSnackbar(false)}
          sx={{ width: '100%' }}
        >
          ¡Respuestas generadas exitosamente!
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default AISuggestionsComponent;
