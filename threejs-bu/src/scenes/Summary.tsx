import { useParams } from "react-router-dom"



export function Summary(){

    const {id} = useParams();

    return (
        <div className="relative h-full w-full bg-[#8FB1D6] flex flex-col items-center justify-start p-1">

        </div>
    )
}