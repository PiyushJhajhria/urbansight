function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-heading">
      <div>
        <p className="panel-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
    </div>
  );
}

export default PageHeader;
