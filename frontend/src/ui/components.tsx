import type {ReactNode} from 'react';
export function Card({title,extra,children,className=''}:{title?:string;extra?:ReactNode;children:ReactNode;className?:string}){return <section className={`card ${className}`}>{title&&<div className="card-heading"><h2>{title}</h2>{extra}</div>}{children}</section>}
export function Action({children,onClick,secondary=false}:{children:ReactNode;onClick:()=>void;secondary?:boolean}){return <button className={secondary?'button secondary':'button'} onClick={onClick}>{children}</button>}
