## Global scripts

Scripts that operate over all the IGs

### makeGlobalIGSummary

Construct the summary html page and optionally post to clinfhir
Has the summary of NZ IGs (that follow the sushi creation pattern)
Also produces a file (allVS.json) that lists where each ValueSet is defined for audit purposes

#### Use:

After updating any of the covered IG's, run this script with upload off. 
Check the allVS and allExt to ensure everything is only defined once
When all good, run again with the upload set to update the online summary