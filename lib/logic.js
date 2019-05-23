/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/**
 * Write your transction processor functions here
 */

/**
 * Sample transaction
 * @param {artivatic.task.SampleTransaction} sampleTransaction
 * @transaction
 */
async function sampleTransaction(tx) {
    // Save the old value of the asset.
    const oldValue = tx.asset.value;

    // Update the asset with the new value.
    tx.asset.value = tx.newValue;

    // Get the asset registry for the asset.
    const assetRegistry = await getAssetRegistry('artivatic.task.SampleAsset');
    // Update the asset in the asset registry.
    await assetRegistry.update(tx.asset);

    // Emit an event for the modified asset.
    let event = getFactory().newEvent('artivatic.task', 'SampleEvent');
    event.asset = tx.asset;
    event.oldValue = oldValue;
    event.newValue = tx.newValue;
    emit(event);
}

/**
 * UploadTask transaction
 * @param {artivatic.task.tasks.UploadTask} taskData
 * @transaction
 */
async function uploadTask(taskData) {

    const factory = getFactory();

    // Make a new Task resource
    var task = factory.newResource('artivatic.task.tasks','Task',taskData.taskId);

    task.technology = taskData.technology;
    task.link = taskData.link;
    task.student = factory.newRelationship('artivatic.task.participants','Student',getCurrentParticipant().getIdentifier());
    
    // Add the new task to Task Registry
    const taskRegistry = await getAssetRegistry('artivatic.task.tasks.Task');
    await taskRegistry.add(task);
    console.log('Task successfully added!');
}


/**
 * ApproveTask transaction
 * @param {artivatic.task.tasks.ApproveTask} approvalData
 * @transaction
 */
async function approveTask(approvalData) {

    const factory = getFactory();
    const taskRegistry = await getAssetRegistry('artivatic.task.tasks.Task');
    var task = await taskRegistry.get(approvalData.taskId);

    // Check if evaluator has required qualifications
    var evaluator = getCurrentParticipant();
    
    var validity = false;

    var technologies;
    
    if(evaluator.getType() == 'NetworkAdmin'){
        
        // To allow Network Admin to approve on behalf of evaluator, using optional field (evaluatorId) in approvalData 
        // This will bypass tech rating requirement for evaluator 
        if(approvalData.evaluatorId){
            var evaluators = await getParticipantRegistry('artivatic.task.participants.Evaluator');
            evaluator = await evaluators.get(approvalData.evaluatorId);
            validity = true;
        }
        
        //return;
    }
    else{

        technologies = evaluator.technologies;

        technologies.forEach((technology)=>{
            if((technology.techName == task.technology) && (technology.rating >= 1000)){
                validity = true;
            }
        })
    }

    // If valid evaluator, add evaluator's approval to the task
    if(!validity){
        console.log('Eligibility not met!')
        return;
    }

    var approval = factory.newRelationship('artivatic.task.participants','Evaluator',evaluator.getIdentifier());

    console.log(approval.getIdentifier())
    if(!task.approvals){
        task.approvals = [];
    }

    // Check if approval already exists before pushing approval to array
    var push = true;
    task.approvals.forEach((appr)=>{
        appr = appr.getIdentifier();
        if(appr==approval.getIdentifier()){
            push = false;
        }
    });
    if(push){
        task.approvals.push(approval);
    }
    else{
        console.log('Already approved!');
        return;
    }

    await taskRegistry.update(task);
    
    console.log('Task approved successfully!');
    
}

/**
 * RescindApproval transaction
 * @param {artivatic.task.tasks.RescindApproval} rescintionData
 * @transaction
 */
async function rescindApproval(rescintionData) {

    const taskRegistry = await getAssetRegistry('artivatic.task.tasks.Task');
    var task = await taskRegistry.get(rescintionData.taskId);

    var evaluator = getCurrentParticipant();
    if(evaluator.type() == 'NetworAdmin'){
        return;
    }

    var approval = factory.newRelationship('artivatic.task.participants','Evaluator',evaluator.getIdentifier());
    
    // Get position of approval by finding index using indexOf with identifiers of relationships
    var pos = task.approvals.map((a)=>{return a.getIdentifier();}).indexOf(approval.getIdentifier());
    if(pos > -1){
        task.approvals.splice(pos,1);
    }

    await taskRegistry.update(task);

    console.log('Approval successfully rescinded!')
}

/**
 * IssueCertificate transaction
 * @param {artivatic.task.certificates.IssueCertificate} certificateData
 * @transaction
 */
async function issueCertificate(certificateData) {
    var taskId = certificateData.task.getIdentifier();
    
    const taskRegistry = await getAssetRegistry('artivatic.task.tasks.Task');

    console.log(taskId);
    var task =  await taskRegistry.get(taskId);

    var approved = (task.approvals.length >= 5);

    if(!approved){
        console.log('Not enough approvals reached!')
        return;
    }

    const factory = getFactory();

    var certificate = factory.newResource('artivatic.task.certificates','Certificate',certificateData.certificateId);

    certificate.technology = task.technology;
    certificate.issuedOn = new Date();
    certificate.student = task.student;
    certificate.mentors = task.approvals;

    const certificateRegistry = await getAssetRegistry('artivatic.task.certificates.Certificate');

    await certificateRegistry.add(certificate);
    console.log('Certificate successfully issued!');
}