import React from 'react';
import { Icon } from './Icons';

export const PageHero = ({ icon = 'users', title, description, action, className = '' }) => (
  <section className={`page-hero ${className}`}>
    <div className="page-hero-icon" aria-hidden="true">
      <Icon name={icon} size={30} />
    </div>
    <div className="page-hero-copy">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    <div className="page-hero-art" aria-hidden="true">
      <img src="/assets/campus-banner.webp" alt="" loading="lazy" decoding="async" />
    </div>
    {action ? <div className="page-hero-action">{action}</div> : null}
  </section>
);

export default PageHero;
