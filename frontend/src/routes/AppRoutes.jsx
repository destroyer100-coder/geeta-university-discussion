import React from 'react';
import { Routes, Route, useOutletContext } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Home } from '../pages/Home';
import { ExplorePage } from '../pages/Explore';
import { CommunityList } from '../pages/Communities/CommunityList';
import { CommunityDetails } from '../pages/Communities/CommunityDetails';
import { CreateCommunity } from '../pages/Communities/CreateCommunity';
import { DiscussionDetails } from '../pages/Discussion/DiscussionDetails';
import { CreatePostPage } from '../pages/CreatePost';
import { EventsPage } from '../pages/Events';
import { PeoplePage } from '../pages/People';
import { ProfilePage } from '../pages/Profile';
import { SavedPage } from '../pages/Saved';
import { MyDiscussionsPage } from '../pages/MyDiscussions';
import { NotificationsPage } from '../pages/Notifications';
import { MessagesPage } from '../pages/Messages';
import { SearchPage } from '../pages/Search';
import { LoginPage } from '../pages/Auth/Login';
import { RegisterPage } from '../pages/Auth/Register';
import { VerifyEmailPage } from '../pages/Auth/VerifyEmail';

// Helper wrappers to pass openCreatePost from MainLayout's Outlet context
const HomeWrapper = () => {
  const { openCreatePost } = useOutletContext();
  return <Home onOpenCreatePost={openCreatePost} />;
};

const ExploreWrapper = () => {
  const { openCreatePost } = useOutletContext();
  return <ExplorePage onOpenCreatePost={openCreatePost} />;
};

const CommunityDetailsWrapper = () => {
  const { openCreatePost } = useOutletContext();
  return <CommunityDetails onOpenCreatePostWithCommunity={openCreatePost} />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Main app layout routes */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomeWrapper />} />
        <Route path="explore" element={<ExploreWrapper />} />
        <Route path="communities" element={<CommunityList />} />
        <Route path="communities/create" element={<CreateCommunity />} />
        <Route path="communities/:id" element={<CommunityDetailsWrapper />} />
        <Route path="communities/:id/rules" element={<CommunityDetailsWrapper />} />
        <Route path="communities/:id/settings" element={<CommunityDetailsWrapper />} />
        <Route path="discussions/:id" element={<DiscussionDetails />} />
        <Route path="post/:id" element={<DiscussionDetails />} />
        <Route path="create" element={<CreatePostPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:id" element={<ProfilePage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="my-discussions" element={<MyDiscussionsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  );
};
