import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Transition } from "./Transition";
import { Cover } from "./Cover";
import { Lobby } from './scenes/Lobby';
import { Matching } from './scenes/Matching';
import { Game } from './scenes/Game';
import { Summary } from './scenes/Summary';

export function App(){

    return (
    <BrowserRouter>
    <div className=' relative w-full h-screen overflow-hidden'>
        <div id='audio' className='hidden'>

        </div>
        <Transition />
            <Routes>
                <Route index element={<Cover />} />
                <Route path='/lobby' element={<Lobby />} />
                <Route path='/matching/:id' element={<Matching />} />
                <Route path='/game/:id' element={<Game />} />
                <Route path='/summary/:id' element={<Summary />} />
            </Routes>
        <Cover />
    </div>
    </BrowserRouter>
    )
}