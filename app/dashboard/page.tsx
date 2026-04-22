import React from 'react';

// Other imports...  

const StatusBadge = ({ status }) => {  
    if (status === "active") {  
        return <span className="badge badge-success">Active</span>;  
    }  
    
    // Handle other statuses if necessary...  
};  
  
// Other component code...

export default StatusBadge;