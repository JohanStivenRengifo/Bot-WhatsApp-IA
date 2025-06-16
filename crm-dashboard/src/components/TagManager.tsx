import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import type { ConversationTag } from '../types';
import { useConversationEnhancement } from '../hooks/useConversationEnhancement';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  selectedTags?: ConversationTag[];
  onTagsChange?: (tags: ConversationTag[]) => void;
  conversationId?: string; // Nuevo prop para el ID de la conversación
  readonly?: boolean;
}

/*
// Etiquetas predefinidas comentadas por ahora - no utilizadas
const predefinedTags: ConversationTag[] = [
  {
    id: 'urgent',
    name: 'Urgente',
    color: '#f44336',
    icon: '🚨',
    category: 'priority',
  },
  {
    id: 'technical',
    name: 'Técnico',
    color: '#2196f3',
    icon: '🔧',
    category: 'type',
  },
  {
    id: 'billing',
    name: 'Facturación',
    color: '#ff9800',
    icon: '💰',
    category: 'type',
  },
  {
    id: 'commercial',
    name: 'Comercial',
    color: '#4caf50',
    icon: '💼',
    category: 'type',
  },
  {
    id: 'support',
    name: 'Soporte',
    color: '#9c27b0',
    icon: '🎧',
    category: 'type',
  },
  {
    id: 'complaint',
    name: 'Reclamo',
    color: '#f44336',
    icon: '⚠️',
    category: 'type',
  },
  {
    id: 'query',
    name: 'Consulta',
    color: '#607d8b',
    icon: '❓',
    category: 'general',
  },
  { id: 'vip', name: 'VIP', color: '#ffc107', icon: '⭐', category: 'status' },
  {
    id: 'follow-up',
    name: 'Seguimiento',    color: '#795548',
    icon: '📋',
    category: 'status',
  },
  {
    id: 'new-customer',
    name: 'Cliente Nuevo',
    color: '#00bcd4',
    icon: '🆕',
    category: 'status',
  },
];
*/

const tagCategories = [
  { value: 'general', label: 'General' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'type', label: 'Tipo' },
  { value: 'status', label: 'Estado' },
  { value: 'custom', label: 'Personalizada' },
];

const colorOptions = [
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#009688',
  '#4caf50',
  '#8bc34a',
  '#cddc39',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
  '#795548',
  '#9e9e9e',
  '#607d8b',
];

export const TagManager: React.FC<TagManagerProps> = ({
  open,
  onClose,
  selectedTags = [],
  onTagsChange,
  conversationId,
  readonly = false,
}) => {
  const {
    tags: availableTags,
    // isLoadingTags,
    loadTags,
    createTag,
    updateTag,
    addTagsToConversation,
    removeTagsFromConversation,
    // deleteTag,
  } = useConversationEnhancement();

  const [currentTags, setCurrentTags] =
    useState<ConversationTag[]>(selectedTags);
  const [newTagDialog, setNewTagDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<ConversationTag | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  // Para evitar warnings de variables no utilizadas en display
  void error;
  void isSubmitting;
  void autoSaveStatus;

  // Estados para crear/editar etiqueta
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#2196f3');
  const [tagIcon, setTagIcon] = useState('🏷️');
  const [tagCategory, setTagCategory] = useState<string>('general');
  const [tagDescription, setTagDescription] = useState('');

  useEffect(() => {
    if (open) {
      loadTags().catch(console.error);
    }
  }, [open, loadTags]);

  useEffect(() => {
    setCurrentTags(selectedTags);
  }, [selectedTags]);

  const filteredTags = availableTags.filter((tag) => {
    const matchesCategory =
      filterCategory === 'all' || tag.category === filterCategory;
    const matchesSearch = tag.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const handleAddTag = async (tag: ConversationTag) => {
    if (!currentTags.find((t) => t.id === tag.id)) {
      const newTags = [...currentTags, tag];
      setCurrentTags(newTags);
      onTagsChange?.(newTags);

      // Guardar automáticamente en el backend si tenemos conversationId
      if (conversationId) {
        try {
          setAutoSaveStatus('saving');
          await addTagsToConversation(conversationId, [tag.id]);
          console.log(
            `Etiqueta "${tag.name}" agregada automáticamente a la conversación ${conversationId}`
          );
          setAutoSaveStatus('saved');

          // Limpiar estado después de 2 segundos
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } catch (error) {
          console.error('Error al guardar etiqueta en el backend:', error);
          setAutoSaveStatus('error');
          // Revertir cambio local si falla el guardado
          setCurrentTags(currentTags);
          onTagsChange?.(currentTags);

          // Limpiar estado después de 3 segundos
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        }
      }
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const tagToRemove = currentTags.find((t) => t.id === tagId);
    const newTags = currentTags.filter((t) => t.id !== tagId);
    setCurrentTags(newTags);
    onTagsChange?.(newTags);

    // Guardar automáticamente en el backend si tenemos conversationId
    if (conversationId && tagToRemove) {
      try {
        setAutoSaveStatus('saving');
        await removeTagsFromConversation(conversationId, [tagId]);
        console.log(
          `Etiqueta "${tagToRemove.name}" removida automáticamente de la conversación ${conversationId}`
        );
        setAutoSaveStatus('saved');
      } catch (error) {
        console.error('Error al remover etiqueta en el backend:', error);
        setAutoSaveStatus('error');
        // Revertir cambio local si falla el guardado
        setCurrentTags([...currentTags]);
        onTagsChange?.([...currentTags]);
      }
    }
  };
  const handleCreateTag = async () => {
    if (!tagName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const newTag = await createTag({
        name: tagName,
        color: tagColor,
        icon: tagIcon,
        category: tagCategory as any,
        description: tagDescription,
      });

      handleAddTag(newTag);
      resetTagForm();
      setNewTagDialog(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al crear la etiqueta'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTag = (tag: ConversationTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagIcon(tag.icon || '🏷️');
    setTagCategory(tag.category || 'general');
    setTagDescription(tag.description || '');
    setNewTagDialog(true);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !tagName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const updatedTag = await updateTag(editingTag.id, {
        name: tagName,
        color: tagColor,
        icon: tagIcon,
        category: tagCategory as any,
        description: tagDescription,
      });

      if (updatedTag) {
        // Actualizar en etiquetas actuales si está presente
        if (currentTags.find((t) => t.id === editingTag.id)) {
          const newTags = currentTags.map((t) =>
            t.id === editingTag.id ? updatedTag : t
          );
          setCurrentTags(newTags);
          onTagsChange?.(newTags);
        }
      }

      resetTagForm();
      setNewTagDialog(false);
      setEditingTag(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al actualizar la etiqueta'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetTagForm = () => {
    setTagName('');
    setTagColor('#2196f3');
    setTagIcon('🏷️');
    setTagCategory('general');
    setTagDescription('');
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center">
              <TagIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Gestionar Etiquetas</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Etiquetas actuales */}
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom>
              Etiquetas Aplicadas ({currentTags.length})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {currentTags.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Sin etiquetas aplicadas
                </Typography>
              ) : (
                currentTags.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={`${tag.icon} ${tag.name}`}
                    style={{ backgroundColor: tag.color, color: 'white' }}
                    onDelete={
                      readonly ? undefined : () => handleRemoveTag(tag.id)
                    }
                    size="medium"
                  />
                ))
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Controles de filtro y búsqueda */}
          <Box mb={2}>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <Box flex={1} minWidth="200px">
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar etiquetas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <FilterIcon sx={{ mr: 1, color: 'action.active' }} />
                    ),
                  }}
                />
              </Box>
              <Box minWidth="150px">
                <FormControl fullWidth size="small">
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    label="Categoría"
                  >
                    <MenuItem value="all">Todas</MenuItem>
                    {tagCategories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              {!readonly && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setNewTagDialog(true)}
                  size="small"
                >
                  Nueva
                </Button>
              )}
            </Box>
          </Box>

          {/* Lista de etiquetas disponibles */}
          <Typography variant="subtitle1" gutterBottom>
            Etiquetas Disponibles
          </Typography>
          <Box
            display="flex"
            flexWrap="wrap"
            gap={1}
            maxHeight={300}
            overflow="auto"
          >
            {filteredTags.map((tag) => (
              <Box key={tag.id} position="relative">
                <Chip
                  label={`${tag.icon} ${tag.name}`}
                  style={{
                    backgroundColor: currentTags.find((t) => t.id === tag.id)
                      ? tag.color
                      : 'transparent',
                    color: currentTags.find((t) => t.id === tag.id)
                      ? 'white'
                      : tag.color,
                    border: `1px solid ${tag.color}`,
                  }}
                  onClick={() => !readonly && handleAddTag(tag)}
                  variant={
                    currentTags.find((t) => t.id === tag.id)
                      ? 'filled'
                      : 'outlined'
                  }
                  size="medium"
                />
                {!readonly && tag.id.startsWith('custom_') && (
                  <Box position="absolute" top={-8} right={-8}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTag(tag);
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <EditIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para crear/editar etiqueta */}
      <Dialog
        open={newTagDialog}
        onClose={() => {
          setNewTagDialog(false);
          setEditingTag(null);
          resetTagForm();
        }}
      >
        <DialogTitle>
          {editingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Nombre"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              required
            />
            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={tagCategory}
                  onChange={(e) => setTagCategory(e.target.value)}
                  label="Categoría"
                >
                  {tagCategories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Icono"
                value={tagIcon}
                onChange={(e) => setTagIcon(e.target.value)}
                placeholder="🏷️"
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Color
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {colorOptions.map((color) => (
                  <Box
                    key={color}
                    width={32}
                    height={32}
                    bgcolor={color}
                    borderRadius="50%"
                    border={
                      tagColor === color ? '3px solid #333' : '1px solid #ddd'
                    }
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setTagColor(color)}
                  />
                ))}
              </Box>
            </Box>
            <TextField
              fullWidth
              label="Descripción"
              value={tagDescription}
              onChange={(e) => setTagDescription(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setNewTagDialog(false);
              setEditingTag(null);
              resetTagForm();
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={editingTag ? handleUpdateTag : handleCreateTag}
            variant="contained"
            disabled={!tagName.trim()}
          >
            {editingTag ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TagManager;
