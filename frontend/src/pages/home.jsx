import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext';
import axios from 'axios';
import server from '../environment';

function HomeComponent() {


    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");


    const { addToUserHistory } = useContext(AuthContext);

    let handleJoinVideoCall = async () => {
        if (!meetingCode) {
            alert("Please enter a meeting code");
            return;
        }

        try {
            const response = await axios.get(`${server}/api/v1/meetings/check`, {
                params: { meetingCode: meetingCode }
            });

            if (response.data.exists) {
                await addToUserHistory(meetingCode);
                navigate(`/${meetingCode}`);
            } else {
                alert("Meeting does not exist. Please check the code or create a new meeting.");
            }
        } catch (error) {
            console.error("Error checking meeting existence:", error);
            alert("Something went wrong. Please try again later.");
        }
    }

    let handleCreateMeeting = async () => {
        let randomCode = Math.random().toString(36).substring(2, 7);
        await addToUserHistory(randomCode);
        navigate(`/${randomCode}`);
    }

    return (
        <>

            <div className="navBar">

                <div style={{ display: "flex", alignItems: "center" }}>

                    <h2>Apna Video Call</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={
                        () => {
                            navigate("/history")
                        }
                    }>
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    <Button onClick={() => {
                        localStorage.removeItem("token")
                        navigate("/auth")
                    }}>
                        Logout
                    </Button>
                </div>


            </div>


            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>Providing Quality Video Call Just Like Quality Education</h2>

                        <div style={{ display: 'flex', gap: "10px", flexDirection: "column" }}>

                            <div style={{ display: 'flex', gap: "10px" }}>
                                <Button onClick={handleCreateMeeting} variant='contained' style={{ flex: 1 }}>Create Meeting</Button>
                            </div>

                            <div style={{ display: 'flex', gap: "10px", marginTop: "1rem" }}>
                                <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" style={{ flex: 2 }} />
                                <Button onClick={handleJoinVideoCall} variant='contained' style={{ flex: 1 }}>Join</Button>
                            </div>

                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>
        </>
    )
}


export default withAuth(HomeComponent)