// src/components/LoraManagement.jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import loraService from '../services/loraService';
import { supabase } from '../services/supabaseService';

const LoraManagement = () => {
  const [loras, setLoras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLora, setEditingLora] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  

  // Fetch all LoRAs on component mount
  useEffect(() => {
    fetchLoras();
  }, []);

  // Fetch LoRAs from the database
  const fetchLoras = async () => {
    try {
      setIsLoading(true);
      const loraData = await loraService.getAllLoras();
      setLoras(loraData);
      setError(null);
    } catch (err) {
      console.error('Error fetching LoRAs:', err);
      setError('Failed to load LoRAs. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission for creating/editing a LoRA
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.target);
      const loraData = {
        name: formData.get('name'),
        file_path: formData.get('file_path'),
        display_name: formData.get('display_name'),
        description: formData.get('description'),
        activation_words: formData.get('activation_words'),
        category: formData.get('category'),
        tags: formData.get('tags') ? JSON.parse(formData.get('tags')) : null
      };
      
      // If editing, include the ID
      if (editingLora) {
        loraData.id = editingLora.id;
      }
      
      // Handle preview image upload if provided
      const previewImageFile = formData.get('preview_image');
      if (previewImageFile && previewImageFile.size > 0) {
        const imagePath = await uploadPreviewImage(previewImageFile, editingLora?.id || 'new');
        loraData.preview_image_path = imagePath;
      } else if (editingLora) {
        // Keep existing image path if editing and no new image provided
        loraData.preview_image_path = editingLora.preview_image_path;
      }
      
      // Save the LoRA
      await loraService.saveLoRA(loraData);
      
      // Reset form state
      setEditingLora(null);
      setShowAddForm(false);
      setPreviewImage(null);
      
      // Refresh the list
      fetchLoras();
      
    } catch (err) {
      console.error('Error saving LoRA:', err);
      setError(`Failed to save LoRA: ${err.message}`);
    }
  };

  // Handle uploading a preview image
  const uploadPreviewImage = async (file, loraId) => {
    try {
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${loraId}_${timestamp}_${safeFilename}`;
      
      // Ensure the bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets.some(b => b.name === 'lora-previews');
      
      if (!bucketExists) {
        await supabase.storage.createBucket('lora-previews', {
          public: true,
          fileSizeLimit: 5242880 // 5MB
        });
      }
      
      // Upload the image
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('lora-previews')
        .upload(filename, file, {
          upsert: true,
          cacheControl: '3600'
        });
        
      if (uploadError) {
        throw uploadError;
      }
      
      // Get the public URL
      const { data: urlData } = supabase
        .storage
        .from('lora-previews')
        .getPublicUrl(filename);
      
      return urlData.publicUrl;
      
    } catch (err) {
      console.error('Error uploading preview image:', err);
      throw new Error(`Failed to upload preview image: ${err.message}`);
    }
  };

  // Handle preview image change in the form
  const handlePreviewImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  // Import LoRAs from ComfyUI
  const importLorasFromComfyUI = async () => {
    try {
      setIsImporting(true);
      const importCount = await loraService.importLorasFromComfyUI();
      alert(`Successfully imported ${importCount} LoRAs from ComfyUI`);
      fetchLoras();
    } catch (err) {
      console.error('Error importing LoRAs:', err);
      setError(`Failed to import LoRAs: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Start editing a LoRA
  const handleEdit = (lora) => {
    setEditingLora(lora);
    setShowAddForm(true);
    setPreviewImage(lora.preview_image_path);
  };

  // Delete a LoRA
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this LoRA? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('loras')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        // Refresh the list
        fetchLoras();
        
      } catch (err) {
        console.error('Error deleting LoRA:', err);
        setError(`Failed to delete LoRA: ${err.message}`);
      }
    }
  };

  if (isLoading && !showAddForm && !editingLora) {
    return <LoadingIndicator>Loading LoRAs...</LoadingIndicator>;
  }

  return (
    <LoraManagementContainer>
      <Header>
        <h2>LoRA Management</h2>
        <ButtonGroup>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add New LoRA'}
          </Button>
          <Button 
            onClick={importLorasFromComfyUI} 
            disabled={isImporting}
            className="import"
          >
            {isImporting ? 'Importing...' : 'Import from ComfyUI'}
          </Button>
        </ButtonGroup>
      </Header>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      {(showAddForm || editingLora) && (
        <FormContainer>
          <h3>{editingLora ? 'Edit LoRA' : 'Add New LoRA'}</h3>
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Label>Name (for system use)*</Label>
              <Input 
                type="text" 
                name="name" 
                defaultValue={editingLora?.name || ''} 
                required 
              />
              <HelpText>This is the internal name used by the system. Should match the filename in ComfyUI.</HelpText>
            </FormGroup>
            
            <FormGroup>
              <Label>File Path*</Label>
              <Input 
                type="text" 
                name="file_path" 
                defaultValue={editingLora?.file_path || ''} 
                required 
                placeholder="e.g., Flux/Neon_Cyberpunk_Cyberspace_FLUX.safetensors"
              />
              <HelpText>This is the path to the LoRA file as recognized by ComfyUI.</HelpText>
            </FormGroup>
            
            <FormGroup>
              <Label>Display Name</Label>
              <Input 
                type="text" 
                name="display_name" 
                defaultValue={editingLora?.display_name || ''} 
                placeholder="User-friendly name"
              />
              <HelpText>A friendly name to display in the UI.</HelpText>
            </FormGroup>
            
            <FormGroup>
              <Label>Description</Label>
              <Textarea 
                name="description" 
                defaultValue={editingLora?.description || ''} 
                rows={3}
                placeholder="Describe what this LoRA does"
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Activation Words</Label>
              <Input 
                type="text" 
                name="activation_words" 
                defaultValue={editingLora?.activation_words || ''} 
                placeholder="e.g., cyberpunk, neon, futuristic"
              />
              <HelpText>Comma-separated words that activate this LoRA's style.</HelpText>
            </FormGroup>
            
            <FormGroup>
              <Label>Category</Label>
              <Input 
                type="text" 
                name="category" 
                defaultValue={editingLora?.category || ''} 
                placeholder="e.g., Style, Object, Environment"
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Tags (JSON format)</Label>
              <Textarea 
                name="tags" 
                defaultValue={editingLora?.tags ? JSON.stringify(editingLora.tags, null, 2) : ''}
                rows={2}
                placeholder='{"theme": "cyberpunk", "colors": ["neon", "blue"]}'
              />
              <HelpText>Optional. Enter JSON object with tags for filtering/categorization.</HelpText>
            </FormGroup>
            
            <FormGroup>
              <Label>Preview Image</Label>
              <FileInput 
                type="file" 
                name="preview_image" 
                accept="image/*"
                onChange={handlePreviewImageChange}
              />
              {(previewImage || editingLora?.preview_image_path) && (
                <PreviewContainer>
                  <PreviewImage 
                    src={previewImage || editingLora?.preview_image_path} 
                    alt="Preview" 
                  />
                </PreviewContainer>
              )}
            </FormGroup>
            
            <SubmitButton type="submit">
              {editingLora ? 'Update LoRA' : 'Add LoRA'}
            </SubmitButton>
          </Form>
        </FormContainer>
      )}
      
      {!isLoading && !loras.length && !showAddForm && (
        <EmptyMessage>
          No LoRAs found. You can add new LoRAs manually or import them from ComfyUI.
        </EmptyMessage>
      )}
      
      {!isLoading && !!loras.length && (
        <LoraGrid>
          {loras.map(lora => (
            <LoraCard key={lora.id}>
              {lora.preview_image_path ? (
                <LoraPreview src={lora.preview_image_path} alt={lora.display_name || lora.name} />
              ) : (
                <NoPreview>No Preview</NoPreview>
              )}
              
              <LoraInfo>
                <LoraName>{lora.display_name || lora.name}</LoraName>
                <LoraPath>{lora.file_path}</LoraPath>
                
                {lora.activation_words && (
                  <ActivationWords>
                    <strong>Activation:</strong> {lora.activation_words}
                  </ActivationWords>
                )}
                
                {lora.description && (
                  <LoraDescription>{lora.description}</LoraDescription>
                )}
                
                <ActionButtons>
                  <ActionButton onClick={() => handleEdit(lora)}>Edit</ActionButton>
                  <ActionButton 
                    onClick={() => handleDelete(lora.id)}
                    className="delete"
                  >
                    Delete
                  </ActionButton>
                </ActionButtons>
              </LoraInfo>
            </LoraCard>
          ))}
        </LoraGrid>
      )}
    </LoraManagementContainer>
  );
};

// Styled components
const LoraManagementContainer = styled.div`
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h2 {
    margin: 0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button`
  background-color: ${props => props.className === 'import' ? '#28a745' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 1rem;
  
  &:hover {
    background-color: ${props => props.className === 'import' ? '#218838' : '#0069d9'};
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const FormContainer = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  
  h3 {
    margin-top: 0;
    margin-bottom: 16px;
  }
`;

const Form = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: bold;
  color: #333;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const Textarea = styled.textarea`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
`;

const FileInput = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const HelpText = styled.small`
  color: #6c757d;
  font-size: 0.8rem;
`;

const PreviewContainer = styled.div`
  margin-top: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  background-color: white;
  max-width: 200px;
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 150px;
  display: block;
  margin: 0 auto;
`;

const SubmitButton = styled.button`
  grid-column: 1 / -1;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 16px;
  
  &:hover {
    background-color: #218838;
  }
`;

const LoraGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
`;

const LoraCard = styled.div`
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const LoraPreview = styled.img`
  width: 100%;
  height: 180px;
  object-fit: cover;
  object-position: center;
  background-color: #f8f9fa;
`;

const NoPreview = styled.div`
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  color: #6c757d;
  font-style: italic;
`;

const LoraInfo = styled.div`
  padding: 16px;
`;

const LoraName = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
`;

const LoraPath = styled.div`
  color: #6c757d;
  font-family: monospace;
  font-size: 0.9rem;
  margin-bottom: 12px;
  word-break: break-all;
`;

const ActivationWords = styled.div`
  margin-bottom: 12px;
  font-size: 0.9rem;
`;

const LoraDescription = styled.p`
  color: #333;
  font-size: 0.9rem;
  margin: 12px 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const ActionButton = styled.button`
  background-color: ${props => props.className === 'delete' ? '#dc3545' : '#6c757d'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.className === 'delete' ? '#c82333' : '#5a6268'};
  }
`;

const LoadingIndicator = styled.div`
  padding: 24px;
  color: #6c757d;
  text-align: center;
  font-size: 1.2rem;
`;

const ErrorMessage = styled.div`
  padding: 16px;
  margin-bottom: 24px;
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
`;

const EmptyMessage = styled.div`
  padding: 48px 24px;
  color: #6c757d;
  text-align: center;
  font-size: 1.2rem;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
`;

export default LoraManagement;