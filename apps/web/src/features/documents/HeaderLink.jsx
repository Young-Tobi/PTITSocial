import React from 'react';
import { NavLink } from 'react-router-dom';
export default function HeaderLink({ className }) {
  return (
    <NavLink to="/documents" className={className} aria-label="Kho tài liệu" title="Kho tài liệu">
      📚
    </NavLink>
  );
}
