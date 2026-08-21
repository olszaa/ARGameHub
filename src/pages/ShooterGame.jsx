import React from 'react';
import { Link } from 'react-router-dom';

const ShooterGame = () => {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'white' }}>
      <h1>Bird Shooter Game</h1>
      <p>Hand tracking loading...</p>
      <Link to="/" style={{ color: '#00d2ff' }}>Back to Home</Link>
    </div>
  );
};

export default ShooterGame;
