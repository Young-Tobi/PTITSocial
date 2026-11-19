import React from 'react';
import { NavLink } from 'react-router-dom';
export default function AcademicHeaderLink({ className }) {
  return (
    <NavLink
      to="/questions"
      aria-label="Hỏi đáp học thuật"
      title="Hỏi đáp học thuật"
      className={className}
    >
      ?
    </NavLink>
  );
}
