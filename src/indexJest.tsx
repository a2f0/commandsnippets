import {Link, useLocation} from 'react-router-dom';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom';
import React from 'react';

const About = () => <div>You are on the about page</div>;
const Home = () => <div>You are home</div>;
const NoMatch = () => <div>No match</div>;

export const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

export const App = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route element={<NoMatch />} />
  </Routes>
);
