import {X} from 'lucide-react';
export default function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose}><X size={20}/></button></header>{children}</div></div>}
