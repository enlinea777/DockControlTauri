import type { ReactNode } from "react";

interface Props {
  list?: ReactNode;
  children: ReactNode;
}

export default function Workbench({ list, children }: Props) {
  return (
    <div className="workbench">
      <div className="workbench-main">{children}</div>
      {list ? <div className="workbench-list">{list}</div> : null}
    </div>
  );
}
