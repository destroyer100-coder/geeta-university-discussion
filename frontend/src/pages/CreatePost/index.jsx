import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePostModal } from '../../components/composer/CreatePostModal';

export const CreatePostPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px 0' }}>
      <CreatePostModal
        isOpen={true}
        onClose={() => navigate(-1)}
        onPostCreated={(post) => {
          navigate(post?._id ? `/discussions/${post._id}` : '/');
        }}
      />
    </div>
  );
};
