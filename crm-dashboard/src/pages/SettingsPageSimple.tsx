import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Wifi as WifiIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

const SettingsPageSimple: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    whatsappToken: '',
    whatsappPhoneId: '',
    webhookUrl: '',
    enableNotifications: true,
    enableAutoResponse: true,
    maxConcurrentChats: 10,
    sessionTimeout: 30,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simular guardado
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Configuración del Sistema
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Configuración guardada exitosamente
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Estado del sistema */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Estado del Sistema
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <WifiIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Conexión WhatsApp"
                  secondary="Estado de la conexión con WhatsApp Business API"
                />
                <Chip
                  label="Conectado"
                  color="success"
                  size="small"
                  icon={<CheckCircleIcon />}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PhoneIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Webhook"
                  secondary="Estado del webhook para recibir mensajes"
                />
                <Chip label="Activo" color="success" size="small" />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Configuración de WhatsApp */}
        <Box display="flex" gap={3} flexWrap="wrap">
          <Box flex="1" minWidth="300px">
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configuración de WhatsApp
                </Typography>

                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    label="Token de WhatsApp"
                    value={settings.whatsappToken}
                    onChange={(e) =>
                      handleInputChange('whatsappToken', e.target.value)
                    }
                    placeholder="Ingresa tu token de WhatsApp Business API"
                    fullWidth
                    type="password"
                  />

                  <TextField
                    label="Phone Number ID"
                    value={settings.whatsappPhoneId}
                    onChange={(e) =>
                      handleInputChange('whatsappPhoneId', e.target.value)
                    }
                    placeholder="ID del número de teléfono"
                    fullWidth
                  />

                  <TextField
                    label="URL del Webhook"
                    value={settings.webhookUrl}
                    onChange={(e) =>
                      handleInputChange('webhookUrl', e.target.value)
                    }
                    placeholder="https://tu-dominio.com/webhook"
                    fullWidth
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Box flex="1" minWidth="300px">
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configuración General
                </Typography>

                <Box display="flex" flexDirection="column" gap={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableNotifications}
                        onChange={(e) =>
                          handleInputChange(
                            'enableNotifications',
                            e.target.checked
                          )
                        }
                      />
                    }
                    label="Habilitar notificaciones"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableAutoResponse}
                        onChange={(e) =>
                          handleInputChange(
                            'enableAutoResponse',
                            e.target.checked
                          )
                        }
                      />
                    }
                    label="Respuesta automática"
                  />

                  <TextField
                    label="Chats simultáneos máximos"
                    type="number"
                    value={settings.maxConcurrentChats}
                    onChange={(e) =>
                      handleInputChange(
                        'maxConcurrentChats',
                        parseInt(e.target.value)
                      )
                    }
                    fullWidth
                    inputProps={{ min: 1, max: 100 }}
                  />

                  <TextField
                    label="Timeout de sesión (minutos)"
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) =>
                      handleInputChange(
                        'sessionTimeout',
                        parseInt(e.target.value)
                      )
                    }
                    fullWidth
                    inputProps={{ min: 5, max: 120 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Botones de acción */}
        <Card>
          <CardContent>
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
              >
                Restablecer
              </Button>
              <Button
                variant="contained"
                startIcon={
                  loading ? <CircularProgress size={20} /> : <SaveIcon />
                }
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SettingsPageSimple;
